import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { db, type SessionRecord, type UserRecord } from "../db.js";

const SESSION_COOKIE_NAME = "linka_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;

const selectUser = db.prepare("SELECT * FROM users ORDER BY created_at ASC LIMIT 1");
const selectUserByUsername = db.prepare("SELECT * FROM users WHERE username = ?");
const insertUser = db.prepare(`
  INSERT INTO users (id, username, avatar_url, password_hash, password_salt, created_at, updated_at)
  VALUES (@id, @username, @avatar_url, @password_hash, @password_salt, @created_at, @updated_at)
`);
const updateUserCredentials = db.prepare(`
  UPDATE users
  SET username = @username,
      avatar_url = @avatar_url,
      password_hash = @password_hash,
      password_salt = @password_salt,
      updated_at = @updated_at
  WHERE id = @id
`);
const updateUserAvatar = db.prepare(`
  UPDATE users
  SET avatar_url = @avatar_url,
      updated_at = @updated_at
  WHERE id = @id
`);
const insertSession = db.prepare(`
  INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
  VALUES (@token_hash, @user_id, @expires_at, @created_at)
`);
const selectSessionWithUser = db.prepare(`
  SELECT
    sessions.token_hash,
    sessions.user_id,
    sessions.expires_at,
    sessions.created_at,
    users.id,
    users.username,
    users.avatar_url,
    users.password_hash,
    users.password_salt,
    users.created_at AS user_created_at,
    users.updated_at AS user_updated_at
  FROM sessions
  INNER JOIN users ON users.id = sessions.user_id
  WHERE sessions.token_hash = ?
`);
const deleteSession = db.prepare("DELETE FROM sessions WHERE token_hash = ?");
const deleteExpiredSessions = db.prepare("DELETE FROM sessions WHERE expires_at <= ?");

export interface PublicUser {
  id: string;
  username: string;
  avatarUrl: string;
}

interface SessionWithUserRecord extends SessionRecord {
  id: string;
  username: string;
  avatar_url: string;
  password_hash: string;
  password_salt: string;
  user_created_at: string;
  user_updated_at: string;
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256").toString("hex");
  return { hash, salt };
}

function verifyPassword(password: string, user: UserRecord) {
  const expected = Buffer.from(user.password_hash, "hex");
  const actual = Buffer.from(hashPassword(password, user.password_salt).hash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseCookie(header: string | undefined, name: string) {
  if (!header) {
    return "";
  }

  const parts = header.split(";");
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return "";
}

function toPublicUser(user: UserRecord | SessionWithUserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatar_url
  };
}

function serializeSessionCookie(token: string, maxAge?: number) {
  const secure = config.appUrl.startsWith("https://") ? "; Secure" : "";
  const maxAgePart = typeof maxAge === "number" ? `; Max-Age=${maxAge}` : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/${maxAgePart}${secure}`;
}

export function clearSessionCookie() {
  return serializeSessionCookie("", 0);
}

export function initializeAuth() {
  const existing = selectUser.get() as UserRecord | undefined;
  if (existing) {
    return toPublicUser(existing);
  }

  const now = new Date().toISOString();
  const password = hashPassword(config.defaultPassword);
  const record: UserRecord = {
    id: crypto.randomUUID(),
    username: config.defaultUsername,
    avatar_url: "",
    password_hash: password.hash,
    password_salt: password.salt,
    created_at: now,
    updated_at: now
  };
  insertUser.run(record);
  return toPublicUser(record);
}

export function getSessionFromRequest(request: FastifyRequest) {
  const token = parseCookie(request.headers.cookie, SESSION_COOKIE_NAME);
  if (!token) {
    return null;
  }

  const row = selectSessionWithUser.get(hashToken(token)) as SessionWithUserRecord | undefined;
  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    deleteSession.run(row.token_hash);
    return null;
  }

  return {
    tokenHash: row.token_hash,
    user: toPublicUser(row)
  };
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const session = getSessionFromRequest(request);
  if (!session) {
    reply.code(401).send({ message: "请先登录" });
    return null;
  }
  return session.user;
}

export function login(username: string, password: string, rememberSession: boolean) {
  const user = selectUserByUsername.get(username) as UserRecord | undefined;
  if (!user || !verifyPassword(password, user)) {
    return null;
  }

  const now = new Date();
  deleteExpiredSessions.run(now.toISOString());
  const token = crypto.randomBytes(32).toString("base64url");
  insertSession.run({
    token_hash: hashToken(token),
    user_id: user.id,
    expires_at: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
    created_at: now.toISOString()
  });

  return {
    user: toPublicUser(user),
    cookie: serializeSessionCookie(token, rememberSession ? SESSION_MAX_AGE_SECONDS : undefined)
  };
}

export function logout(request: FastifyRequest) {
  const token = parseCookie(request.headers.cookie, SESSION_COOKIE_NAME);
  if (token) {
    deleteSession.run(hashToken(token));
  }
}

export function updateCredentials(userId: string, input: { currentPassword: string; username: string; avatarUrl?: string; newPassword?: string }) {
  const current = selectUser.get() as UserRecord | undefined;
  if (!current || current.id !== userId) {
    return { status: "not_found" as const };
  }

  if (!verifyPassword(input.currentPassword, current)) {
    return { status: "invalid_password" as const };
  }

  const username = input.username.trim();
  const password = input.newPassword ? hashPassword(input.newPassword) : {
    hash: current.password_hash,
    salt: current.password_salt
  };
  const next: UserRecord = {
    id: current.id,
    username,
    avatar_url: input.avatarUrl?.trim() ?? current.avatar_url,
    password_hash: password.hash,
    password_salt: password.salt,
    created_at: current.created_at,
    updated_at: new Date().toISOString()
  };

  updateUserCredentials.run(next);
  return {
    status: "updated" as const,
    user: toPublicUser(next)
  };
}

export function updateAvatar(userId: string, avatarUrl: string) {
  const current = selectUser.get() as UserRecord | undefined;
  if (!current || current.id !== userId) {
    return null;
  }

  const next: UserRecord = {
    ...current,
    avatar_url: avatarUrl.trim(),
    updated_at: new Date().toISOString()
  };
  updateUserAvatar.run({
    id: next.id,
    avatar_url: next.avatar_url,
    updated_at: next.updated_at
  });
  return toPublicUser(next);
}
