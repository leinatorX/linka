import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { setupVaultMasterPassword, getVaultStatus, unlockVault, lockVault } from "../services/vault.js";
import { deriveVaultKey, createVaultVerifier, verifyVaultKey, generateSalt, encryptPayload, decryptPayload } from "../utils/vaultCrypto.js";
import { db } from "../db.js";

vi.mock("../db.js", () => {
  const mDb = {
    prepare: vi.fn(() => ({
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    })),
    transaction: vi.fn((cb) => cb),
  };
  return { db: mDb };
});

describe("vault crypto & service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("vaultCrypto (AES-GCM, derivation)", () => {
    it("should derive vault key correctly", () => {
      const password = "my_master_password";
      const salt = generateSalt();
      const key1 = deriveVaultKey(password, salt);
      const key2 = deriveVaultKey(password, salt);
      
      expect(key1).toBeInstanceOf(Buffer);
      expect(key1.length).toBe(32);
      expect(key1.toString("hex")).toBe(key2.toString("hex")); // deterministic
    });

    it("should verify vault key via verifier", () => {
      const password = "my_master_password";
      const salt = generateSalt();
      const key = deriveVaultKey(password, salt);
      const verifier = createVaultVerifier(key);

      const isValid = verifyVaultKey(key, verifier);
      expect(isValid).toBe(true);
      
      // Try wrong key
      const wrongKey = deriveVaultKey("wrong_password", salt);
      const isInvalid = verifyVaultKey(wrongKey, verifier);
      expect(isInvalid).toBe(false);
    });

    it("should encrypt and decrypt payload with AES-GCM and verify AuthTag", () => {
      const key = crypto.randomBytes(32);
      const payload = { secret: "my_api_key_123", num: 42 };

      const { encryptedPayload, iv, authTag } = encryptPayload(payload, key);
      
      expect(encryptedPayload).not.toBe(JSON.stringify(payload));
      expect(iv).toBeDefined();
      expect(authTag).toBeDefined();

      const decrypted = decryptPayload<typeof payload>(encryptedPayload, key, iv, authTag);
      expect(decrypted).toEqual(payload);
      
      // Test AuthTag tampering
      expect(() => {
        const tamperedAuthTag = "tampered" + authTag.slice(8);
        decryptPayload(encryptedPayload, key, iv, tamperedAuthTag);
      }).toThrow();
    });
  });

  describe("Vault Service operations", () => {
    it("should setup vault master password", () => {
      let saltValue = "";
      const mockGetSettings = { get: vi.fn(() => undefined as { value: string } | undefined) };
      const mockInsertSettings = { 
        run: vi.fn((k, v, t) => { 
          if (k === "vault_salt") saltValue = v;
        }) 
      };

      (db.prepare as any).mockImplementation((query: string) => {
        if (query.includes("SELECT value FROM vault_settings")) return mockGetSettings;
        if (query.includes("INSERT OR REPLACE INTO vault_settings")) return mockInsertSettings;
        return { get: vi.fn(), run: vi.fn() };
      });

      const { vaultToken } = setupVaultMasterPassword("secure_master_pwd");
      expect(vaultToken).toBeDefined();
      expect(mockInsertSettings.run).toHaveBeenCalledTimes(2);
      
      const status = getVaultStatus(vaultToken);
      // Wait, we mocked db but getVaultStatus will also query db for salt.
      // So let's mock it to return the salt we saved.
      mockGetSettings.get.mockReturnValueOnce({ value: saltValue });
      const status2 = getVaultStatus(vaultToken);
      expect(status2.isInitialized).toBe(true);
      expect(status2.isUnlocked).toBe(true);
    });
  });
});
