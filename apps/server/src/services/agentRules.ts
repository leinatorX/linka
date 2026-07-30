import crypto from "node:crypto";
import { db, toAgentRule } from "../db.js";
import type { AgentRuleRecord } from "../db.js";

export interface AgentRuleInput {
  title: string;
  ruleType?: string;
  category?: string;
  description?: string;
  content: string;
  tags?: string[];
  isPinned?: boolean;
}

export function listAgentRules(search?: string, category?: string, ruleType?: string) {
  let sql = "SELECT * FROM agent_rules";
  const conditions: string[] = [];
  const params: any[] = [];

  if (category && category !== "all") {
    conditions.push("category = ?");
    params.push(category);
  }

  if (ruleType && ruleType !== "all") {
    conditions.push("rule_type = ?");
    params.push(ruleType);
  }

  if (search && search.trim()) {
    conditions.push("(title LIKE ? OR description LIKE ? OR content LIKE ? OR tags LIKE ?)");
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY is_pinned DESC, updated_at DESC";

  const records = db.prepare(sql).all(...params) as AgentRuleRecord[];
  return records.map(toAgentRule);
}

export function getAgentRule(id: string) {
  const record = db.prepare("SELECT * FROM agent_rules WHERE id = ?").get(id) as AgentRuleRecord | undefined;
  if (!record) {
    throw new Error("Agent rule not found");
  }
  return toAgentRule(record);
}

export function createAgentRule(input: AgentRuleInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tagsStr = JSON.stringify(input.tags || []);

  db.prepare(`
    INSERT INTO agent_rules (
      id, title, rule_type, category, description, content, tags, is_pinned, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.title.trim(),
    input.ruleType || "agents_md",
    input.category || "general",
    input.description || "",
    input.content || "",
    tagsStr,
    input.isPinned ? 1 : 0,
    now,
    now
  );

  return getAgentRule(id);
}

export function updateAgentRule(id: string, input: Partial<AgentRuleInput>) {
  const existing = db.prepare("SELECT * FROM agent_rules WHERE id = ?").get(id) as AgentRuleRecord | undefined;
  if (!existing) {
    throw new Error("Agent rule not found");
  }

  const now = new Date().toISOString();
  const title = input.title !== undefined ? input.title.trim() : existing.title;
  const ruleType = input.ruleType ?? existing.rule_type;
  const category = input.category ?? existing.category;
  const description = input.description ?? existing.description;
  const content = input.content ?? existing.content;
  const tagsStr = input.tags ? JSON.stringify(input.tags) : existing.tags;
  const isPinned = input.isPinned !== undefined ? (input.isPinned ? 1 : 0) : existing.is_pinned;

  db.prepare(`
    UPDATE agent_rules SET
      title = ?, rule_type = ?, category = ?, description = ?,
      content = ?, tags = ?, is_pinned = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title,
    ruleType,
    category,
    description,
    content,
    tagsStr,
    isPinned,
    now,
    id
  );

  return getAgentRule(id);
}

export function deleteAgentRule(id: string) {
  const info = db.prepare("DELETE FROM agent_rules WHERE id = ?").run(id);
  return info.changes > 0;
}

export function getExportFilename(rule: { title: string; ruleType: string }) {
  switch (rule.ruleType) {
    case "agents_md":
      return "AGENTS.md";
    case "cursorrules":
      return ".cursorrules";
    case "windsurfrules":
      return ".windsurfrules";
    case "claude_md":
      return "CLAUDE.md";
    default:
      const sanitizedTitle = rule.title.replace(/[\/\\?%*:|"<>]/g, "-").trim() || "rule";
      return `${sanitizedTitle}.md`;
  }
}
