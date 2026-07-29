import crypto from "node:crypto";

const PBKDF2_ITERATIONS = 100000;
const KEY_LEN = 32; // 256 bits
const DIGEST = "sha256";
const VERIFIER_MESSAGE = "LINKA_VAULT_MASTER_KEY_VERIFIER";

/**
 * 根据主密码 Master Password 与 Salt 派生 256 位加密 Key
 */
export function deriveVaultKey(masterPassword: string, salt: string): Buffer {
  return crypto.pbkdf2Sync(
    masterPassword,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LEN,
    DIGEST
  );
}

/**
 * 生成主密码验证器 (Verifier)，用于校验主密码是否正确
 */
export function createVaultVerifier(vaultKey: Buffer): string {
  const hmac = crypto.createHmac("sha256", vaultKey);
  hmac.update(VERIFIER_MESSAGE);
  return hmac.digest("hex");
}

/**
 * 校验主密码派生的 Key 是否与数据库中存储的 Verifier 匹配
 */
export function verifyVaultKey(vaultKey: Buffer, expectedVerifier: string): boolean {
  const calculated = createVaultVerifier(vaultKey);
  return crypto.timingSafeEqual(
    Buffer.from(calculated, "hex"),
    Buffer.from(expectedVerifier, "hex")
  );
}

/**
 * 产生 16 字节随机 Salt
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * 使用 AES-256-GCM 加密 JSON Payload
 */
export function encryptPayload(
  payload: Record<string, any>,
  vaultKey: Buffer
): { encryptedPayload: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12); // 96 bits for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey, iv);
  
  const jsonStr = JSON.stringify(payload);
  let encrypted = cipher.update(jsonStr, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag().toString("base64");
  
  return {
    encryptedPayload: encrypted,
    iv: iv.toString("base64"),
    authTag
  };
}

/**
 * 使用 AES-256-GCM 解密 Payload
 */
export function decryptPayload<T = Record<string, any>>(
  encryptedPayload: string,
  vaultKey: Buffer,
  iv: string,
  authTag: string
): T {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    vaultKey,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  
  let decrypted = decipher.update(encryptedPayload, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return JSON.parse(decrypted) as T;
}
