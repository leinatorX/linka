import { randomUUID } from "node:crypto";
import { db, toAssistantConversation, toAssistantMessage } from "../db.js";
import type { AssistantConversationRecord, AssistantMessageRecord } from "../db.js";

const selectConversations = db.prepare("SELECT * FROM assistant_conversations ORDER BY updated_at DESC");
const selectConversationById = db.prepare("SELECT * FROM assistant_conversations WHERE id = ?");
const selectMessagesByConversationId = db.prepare("SELECT * FROM assistant_messages WHERE conversation_id = ? ORDER BY created_at ASC");
const insertConversation = db.prepare(`
  INSERT INTO assistant_conversations (id, title, created_at, updated_at)
  VALUES (?, ?, ?, ?)
`);
const updateConversation = db.prepare("UPDATE assistant_conversations SET title = ?, updated_at = ? WHERE id = ?");
const touchConversation = db.prepare("UPDATE assistant_conversations SET updated_at = ? WHERE id = ?");
const deleteConversationRecord = db.prepare("DELETE FROM assistant_conversations WHERE id = ?");
const deleteMessagesByConversationId = db.prepare("DELETE FROM assistant_messages WHERE conversation_id = ?");
const insertMessage = db.prepare(`
  INSERT INTO assistant_messages (id, conversation_id, role, content, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

function createTitle(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 28) || "新对话";
}

export function listAssistantConversations() {
  return (selectConversations.all() as AssistantConversationRecord[]).map(toAssistantConversation);
}

export function createAssistantConversation(title = "新对话") {
  const now = new Date().toISOString();
  const id = randomUUID();
  insertConversation.run(id, title, now, now);
  return toAssistantConversation(selectConversationById.get(id) as AssistantConversationRecord);
}

export function getAssistantConversation(id: string) {
  const conversation = selectConversationById.get(id) as AssistantConversationRecord | undefined;
  if (!conversation) {
    return null;
  }

  return {
    conversation: toAssistantConversation(conversation),
    messages: (selectMessagesByConversationId.all(id) as AssistantMessageRecord[]).map(toAssistantMessage)
  };
}

export function ensureAssistantConversation(conversationId: string | undefined, firstMessage: string) {
  if (conversationId) {
    const existing = selectConversationById.get(conversationId) as AssistantConversationRecord | undefined;
    if (existing) {
      return toAssistantConversation(existing);
    }
  }

  return createAssistantConversation(createTitle(firstMessage));
}

export function addAssistantMessage(conversationId: string, role: "user" | "assistant", content: string) {
  const now = new Date().toISOString();
  const id = randomUUID();
  insertMessage.run(id, conversationId, role, content, now);
  touchConversation.run(now, conversationId);

  if (role === "user") {
    const conversation = selectConversationById.get(conversationId) as AssistantConversationRecord | undefined;
    if (conversation?.title === "新对话") {
      updateConversation.run(createTitle(content), now, conversationId);
    }
  }

  return toAssistantMessage(selectMessagesByConversationId.all(conversationId).at(-1) as AssistantMessageRecord);
}

export function buildConversationContext(conversationId: string, limit = 12) {
  const messages = (selectMessagesByConversationId.all(conversationId) as AssistantMessageRecord[]).slice(-limit);
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

export function deleteAssistantConversations(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const transaction = db.transaction((conversationIds: string[]) => {
    for (const id of conversationIds) {
      deleteMessagesByConversationId.run(id);
      deleteConversationRecord.run(id);
    }
  });

  transaction(uniqueIds);
  return uniqueIds.length;
}
