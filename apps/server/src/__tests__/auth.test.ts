import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { initializeAuth, verifyUserPassword, getSessionFromRequest, login, clearSessionCookie } from "../services/auth.js";
import { db } from "../db.js";

const { mockStmts } = vi.hoisted(() => ({
  mockStmts: {} as Record<string, { get: any; run: any; all: any }>
}));

export function getMockStmt(queryPart: string) {
  const key = Object.keys(mockStmts).find(k => k.includes(queryPart));
  if (!key) throw new Error("Query not found: " + queryPart);
  return mockStmts[key];
}

vi.mock("../db.js", () => {
  const mDb = {
    prepare: vi.fn((query: string) => {
      if (!mockStmts[query]) {
        mockStmts[query] = { get: vi.fn(), run: vi.fn(), all: vi.fn() };
      }
      return mockStmts[query];
    }),
  };
  return { db: mDb };
});

vi.mock("../config.js", () => ({
  config: {
    appUrl: "http://localhost",
    defaultUsername: "admin",
    defaultPassword: "password123"
  }
}));

describe("auth.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Password Hashing & Verification", () => {
    it("should hash password with PBKDF2 and verify successfully", () => {
      let insertedUser: any = null;
      
      const insertStmt = getMockStmt("INSERT INTO users");
      const selectStmt = getMockStmt("ORDER BY created_at ASC LIMIT 1");

      insertStmt.run.mockImplementation((record: any) => { insertedUser = record; });
      selectStmt.get.mockImplementation(() => insertedUser);

      // trigger hashPassword
      initializeAuth();
      
      expect(insertStmt.run).toHaveBeenCalled();
      expect(insertedUser).not.toBeNull();
      expect(insertedUser.password_hash).toBeDefined();
      expect(insertedUser.password_salt).toBeDefined();

      // trigger verifyPassword
      const isValid = verifyUserPassword(insertedUser.id, "password123");
      expect(isValid).toBe(true);
      
      const isInvalid = verifyUserPassword(insertedUser.id, "wrongpassword");
      expect(isInvalid).toBe(false);
    });
  });

  describe("Session Token Verification", () => {
    it("should verify session token correctly", () => {
      const mockSession = {
        token_hash: "mock_hash",
        user_id: "user1",
        expires_at: new Date(Date.now() + 100000).toISOString(),
        created_at: new Date().toISOString(),
        id: "user1",
        username: "admin",
        avatar_url: ""
      };

      const selectSessionStmt = getMockStmt("INNER JOIN users ON users.id = sessions.user_id");
      selectSessionStmt.get.mockImplementation(() => mockSession);

      // A simple mock token "test_token"
      const fakeToken = "test_token";
      const requestMock: any = {
        headers: {
          cookie: `linka_session=${fakeToken}`
        }
      };

      const session = getSessionFromRequest(requestMock);
      expect(selectSessionStmt.get).toHaveBeenCalled();
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe("user1");
      expect(session?.user.username).toBe("admin");
    });
    
    it("should return null if session is expired", () => {
      const mockSession = {
        token_hash: "mock_hash",
        user_id: "user1",
        expires_at: new Date(Date.now() - 100000).toISOString(),
        created_at: new Date().toISOString(),
        id: "user1",
        username: "admin",
        avatar_url: ""
      };
      
      const selectSessionStmt = getMockStmt("INNER JOIN users ON users.id = sessions.user_id");
      const deleteSessionStmt = getMockStmt("DELETE FROM sessions WHERE token_hash");

      selectSessionStmt.get.mockImplementation(() => mockSession);
      deleteSessionStmt.run.mockImplementation(() => {});

      const requestMock: any = {
        headers: { cookie: "linka_session=test_token" }
      };

      const session = getSessionFromRequest(requestMock);
      expect(session).toBeNull();
      expect(deleteSessionStmt.run).toHaveBeenCalled();
    });
  });
});
