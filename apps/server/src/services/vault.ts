import crypto from "node:crypto";
import { db } from "../db.js";
import type { VaultItemRecord, VaultSettingRecord } from "../db.js";
import {
  createVaultVerifier,
  decryptPayload,
  deriveVaultKey,
  encryptPayload,
  generateSalt,
  verifyVaultKey
} from "../utils/vaultCrypto.js";

interface VaultSession {
  vaultKey: Buffer;
  expiresAt: number;
}

// 内存保存解锁会话，Token 默认 15 分钟存活（每次使用自动续期）
const activeVaultSessions = new Map<string, VaultSession>();
const VAULT_SESSION_TTL_MS = 15 * 60 * 1000;

export interface VaultItemInput {
  category?: string;
  serviceName: string;
  title: string;
  credentialType: "api_key" | "secret_pair" | "user_password" | "custom";
  iconUrl?: string;
  tags?: string[];
  payload: {
    apiKey?: string;
    secretId?: string;
    secretKey?: string;
    username?: string;
    password?: string;
    websiteUrl?: string;
    customFields?: Array<{ key: string; value: string; type?: "text" | "password" }>;
    notes?: string;
  };
}

/**
 * 清理过期的 Vault Sessions
 */
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeVaultSessions.entries()) {
    if (session.expiresAt < now) {
      activeVaultSessions.delete(token);
    }
  }
}

/**
 * 检查保险箱状态：是否已初始化、是否已解锁
 */
export function getVaultStatus(vaultToken?: string): { isInitialized: boolean; isUnlocked: boolean } {
  cleanExpiredSessions();
  
  const saltRow = db.prepare("SELECT value FROM vault_settings WHERE key = 'vault_salt'").get() as VaultSettingRecord | undefined;
  const isInitialized = Boolean(saltRow && saltRow.value);
  
  let isUnlocked = false;
  if (vaultToken && activeVaultSessions.has(vaultToken)) {
    const session = activeVaultSessions.get(vaultToken)!;
    if (session.expiresAt > Date.now()) {
      isUnlocked = true;
    } else {
      activeVaultSessions.delete(vaultToken);
    }
  }
  
  return { isInitialized, isUnlocked };
}

/**
 * 获取当前的 Vault Key（如果 Token 有效）
 */
export function getVaultKeyFromToken(vaultToken?: string): Buffer | null {
  if (!vaultToken) return null;
  cleanExpiredSessions();
  const session = activeVaultSessions.get(vaultToken);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    activeVaultSessions.delete(vaultToken);
    return null;
  }
  // 续期
  session.expiresAt = Date.now() + VAULT_SESSION_TTL_MS;
  return session.vaultKey;
}

/**
 * 首次初始化保险箱主密码
 */
export function setupVaultMasterPassword(masterPassword: string): { vaultToken: string } {
  const saltRow = db.prepare("SELECT value FROM vault_settings WHERE key = 'vault_salt'").get() as VaultSettingRecord | undefined;
  if (saltRow && saltRow.value) {
    throw new Error("Vault is already initialized");
  }
  
  const salt = generateSalt();
  const vaultKey = deriveVaultKey(masterPassword, salt);
  const verifier = createVaultVerifier(vaultKey);
  const now = new Date().toISOString();
  
  const insertStmt = db.prepare(
    "INSERT OR REPLACE INTO vault_settings (key, value, updated_at) VALUES (?, ?, ?)"
  );
  
  db.transaction(() => {
    insertStmt.run("vault_salt", salt, now);
    insertStmt.run("vault_verifier", verifier, now);
  })();
  
  // 创建 Vault Session
  const vaultToken = crypto.randomUUID();
  activeVaultSessions.set(vaultToken, {
    vaultKey,
    expiresAt: Date.now() + VAULT_SESSION_TTL_MS
  });
  
  return { vaultToken };
}

/**
 * 输入主密码解锁保险箱
 */
export function unlockVault(masterPassword: string): { vaultToken: string } {
  const saltRow = db.prepare("SELECT value FROM vault_settings WHERE key = 'vault_salt'").get() as VaultSettingRecord | undefined;
  const verifierRow = db.prepare("SELECT value FROM vault_settings WHERE key = 'vault_verifier'").get() as VaultSettingRecord | undefined;
  
  if (!saltRow || !verifierRow) {
    throw new Error("Vault is not initialized");
  }
  
  const vaultKey = deriveVaultKey(masterPassword, saltRow.value);
  const isValid = verifyVaultKey(vaultKey, verifierRow.value);
  
  if (!isValid) {
    throw new Error("Invalid master password");
  }
  
  const vaultToken = crypto.randomUUID();
  activeVaultSessions.set(vaultToken, {
    vaultKey,
    expiresAt: Date.now() + VAULT_SESSION_TTL_MS
  });
  
  return { vaultToken };
}

/**
 * 主动锁定保险箱
 */
export function lockVault(vaultToken?: string): boolean {
  if (vaultToken && activeVaultSessions.has(vaultToken)) {
    activeVaultSessions.delete(vaultToken);
    return true;
  }
  return false;
}

/**
 * 注销并重置保险箱（清空所有凭据和主密码）
 */
export function resetVault(): void {
  activeVaultSessions.clear();
  db.transaction(() => {
    db.prepare("DELETE FROM vault_items").run();
    db.prepare("DELETE FROM vault_settings WHERE key IN ('vault_salt', 'vault_verifier')").run();
  })();
}

/**
 * 生成遮罩 preview
 */
function makeMaskPreview(str?: string): string {
  if (!str) return "";
  if (str.length <= 6) return "••••••";
  return `${str.slice(0, 3)}••••••••${str.slice(-4)}`;
}

/**
 * 获取凭据列表（摘要信息与遮罩）
 */
export function listVaultItems(
  vaultKey: Buffer,
  search?: string,
  category?: string
) {
  let sql = "SELECT * FROM vault_items";
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (category && category !== "all") {
    conditions.push("category = ?");
    params.push(category);
  }
  
  if (search && search.trim()) {
    conditions.push("(service_name LIKE ? OR title LIKE ? OR tags LIKE ?)");
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  
  sql += " ORDER BY updated_at DESC";
  
  const records = db.prepare(sql).all(...params) as VaultItemRecord[];
  
  return records.map((record) => {
    let preview = "";
    try {
      const payload = decryptPayload<Record<string, any>>(
        record.encrypted_payload,
        vaultKey,
        record.iv,
        record.auth_tag
      );
      if (payload.apiKey) {
        preview = makeMaskPreview(payload.apiKey);
      } else if (payload.username) {
        preview = payload.username;
      } else if (payload.secretId) {
        preview = makeMaskPreview(payload.secretId);
      }
    } catch (e) {
      preview = "••••••••";
    }
    
    return {
      id: record.id,
      category: record.category,
      serviceName: record.service_name,
      title: record.title,
      credentialType: record.credential_type,
      iconUrl: record.icon_url,
      tags: JSON.parse(record.tags || "[]"),
      preview,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  });
}

/**
 * 获取单个凭据解密明文
 */
export function getVaultItemDetail(id: string, vaultKey: Buffer) {
  const record = db.prepare("SELECT * FROM vault_items WHERE id = ?").get(id) as VaultItemRecord | undefined;
  if (!record) {
    throw new Error("Vault item not found");
  }
  
  const payload = decryptPayload(
    record.encrypted_payload,
    vaultKey,
    record.iv,
    record.auth_tag
  );
  
  return {
    id: record.id,
    category: record.category,
    serviceName: record.service_name,
    title: record.title,
    credentialType: record.credential_type,
    iconUrl: record.icon_url,
    tags: JSON.parse(record.tags || "[]"),
    payload,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

/**
 * 新增凭据
 */
export function createVaultItem(input: VaultItemInput, vaultKey: Buffer) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const { encryptedPayload, iv, authTag } = encryptPayload(input.payload, vaultKey);
  const tagsStr = JSON.stringify(input.tags || []);
  
  db.prepare(`
    INSERT INTO vault_items (
      id, category, service_name, title, credential_type, icon_url,
      encrypted_payload, iv, auth_tag, tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.category || "ai_provider",
    input.serviceName,
    input.title,
    input.credentialType,
    input.iconUrl || "",
    encryptedPayload,
    iv,
    authTag,
    tagsStr,
    now,
    now
  );
  
  return getVaultItemDetail(id, vaultKey);
}

/**
 * 更新凭据
 */
export function updateVaultItem(id: string, input: Partial<VaultItemInput>, vaultKey: Buffer) {
  const existing = db.prepare("SELECT * FROM vault_items WHERE id = ?").get(id) as VaultItemRecord | undefined;
  if (!existing) {
    throw new Error("Vault item not found");
  }
  
  const now = new Date().toISOString();
  const category = input.category ?? existing.category;
  const serviceName = input.serviceName ?? existing.service_name;
  const title = input.title ?? existing.title;
  const credentialType = input.credentialType ?? existing.credential_type;
  const iconUrl = input.iconUrl ?? existing.icon_url;
  const tagsStr = input.tags ? JSON.stringify(input.tags) : existing.tags;
  
  let encryptedPayload = existing.encrypted_payload;
  let iv = existing.iv;
  let authTag = existing.auth_tag;
  
  if (input.payload) {
    const newEncrypted = encryptPayload(input.payload, vaultKey);
    encryptedPayload = newEncrypted.encryptedPayload;
    iv = newEncrypted.iv;
    authTag = newEncrypted.authTag;
  }
  
  db.prepare(`
    UPDATE vault_items SET
      category = ?, service_name = ?, title = ?, credential_type = ?,
      icon_url = ?, encrypted_payload = ?, iv = ?, auth_tag = ?,
      tags = ?, updated_at = ?
    WHERE id = ?
  `).run(
    category,
    serviceName,
    title,
    credentialType,
    iconUrl,
    encryptedPayload,
    iv,
    authTag,
    tagsStr,
    now,
    id
  );
  
  return getVaultItemDetail(id, vaultKey);
}

/**
 * 删除凭据
 */
export function deleteVaultItem(id: string) {
  const info = db.prepare("DELETE FROM vault_items WHERE id = ?").run(id);
  return info.changes > 0;
}
