// 验证脚本：检查 data/linka.sqlite 中 admin 用户的 linka123456 密码是否匹配
const Database = require("better-sqlite3");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");

const dbPath = process.argv[2] || path.resolve(process.cwd(), "data", "linka.sqlite");
if (!fs.existsSync(dbPath)) {
  console.error("数据库不存在: " + dbPath);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
const row = db
  .prepare("SELECT id, username, password_hash, password_salt FROM users WHERE username = ?")
  .get("admin");
db.close();

if (!row) {
  console.error("数据库里没有 admin 用户");
  process.exit(1);
}

const candidate = "linka123456";
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const computed = crypto
  .pbkdf2Sync(candidate, row.password_salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256")
  .toString("hex");

console.log("user.id               :", row.id);
console.log("user.username         :", row.username);
console.log("user.password_hash    :", row.password_hash);
console.log("user.password_salt    :", row.password_salt);
console.log("expected (linka123456):", computed);
console.log("match                 :", row.password_hash === computed);
