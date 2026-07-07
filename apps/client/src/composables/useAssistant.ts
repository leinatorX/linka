import { computed, ref } from "vue";
import {
  createAssistantConversation,
  deleteAssistantConversations,
  getAssistantConversation,
  listAssistantConversations,
  streamAssistantMessage
} from "../api";
import type { AssistantAttachment, AssistantAttachmentKind, AssistantConversation, Bookmark } from "../types";

export interface AssistantUiMessage {
  role: "user" | "assistant";
  text: string;
  attachments?: AssistantAttachment[];
  reasoning?: string;
  reasoningCollapsed?: boolean;
  results?: Bookmark[];
  streaming?: boolean;
  confirmationRequest?: string;
}

interface UseAssistantOptions {
  loadBookmarks: () => Promise<void>;
  loadCategories?: () => Promise<void>;
  getActiveCategory?: () => string;
}

const maxAttachmentCount = 6;
const maxAttachmentSize = 20 * 1024 * 1024;
const maxAttachmentTotalSize = 60 * 1024 * 1024;

function getAttachmentKind(mimeType: string): AssistantAttachmentKind {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取附件失败"));
    reader.readAsDataURL(file);
  });
}

export function useAssistant(options: UseAssistantOptions) {
  const assistantInput = ref("");
  const assistantOpen = ref(false);
  const assistantModel = ref("");
  const assistantEffort = ref("默认");
  const assistantEffortOptions = ["关闭", "默认", "低", "中", "高", "最大"];
  const modelSelectOpen = ref(false);
  const effortSelectOpen = ref(false);
  const assistantConversations = ref<AssistantConversation[]>([]);
  const activeConversationId = ref<string | null>(null);
  const assistantHistoryOpen = ref(false);
  const assistantHistoryManage = ref(false);
  const selectedConversationIds = ref<Set<string>>(new Set());
  const historySearchInput = ref("");
  // 留空：空状态由 AssistantPanel 中的欢迎页承担，避免在对话流中混入占位气泡。
  const assistantMessages = ref<AssistantUiMessage[]>([]);
  const assistantAttachments = ref<AssistantAttachment[]>([]);
  const isAssistantLoading = ref(false);
  let currentAbortController: AbortController | null = null;

  const activeConversation = computed(() => assistantConversations.value.find((conversation) => conversation.id === activeConversationId.value));
  const filteredAssistantConversations = computed(() => {
    const keyword = historySearchInput.value.trim().toLowerCase();
    if (!keyword) {
      return assistantConversations.value;
    }

    return assistantConversations.value.filter((conversation) => conversation.title.toLowerCase().includes(keyword));
  });

  function addAssistantNotice(message: string) {
    assistantMessages.value.unshift({
      role: "assistant",
      text: message
    });
  }

  function toggleModelSelect(event: Event) {
    event.stopPropagation();
    modelSelectOpen.value = !modelSelectOpen.value;
    effortSelectOpen.value = false;
  }

  function toggleEffortSelect(event: Event) {
    event.stopPropagation();
    effortSelectOpen.value = !effortSelectOpen.value;
    modelSelectOpen.value = false;
  }

  function closeDropdowns() {
    modelSelectOpen.value = false;
    effortSelectOpen.value = false;
  }

  async function loadAssistantConversations(optionsArg: { openFirst?: boolean } = {}) {
    const result = await listAssistantConversations();
    assistantConversations.value = result.conversations;

    if (optionsArg.openFirst && !activeConversationId.value && result.conversations.length) {
      await openAssistantConversation(result.conversations[0].id);
    }
  }

  async function openAssistantConversation(conversationId: string) {
    const result = await getAssistantConversation(conversationId);
    activeConversationId.value = result.conversation.id;
    assistantHistoryOpen.value = false;
    assistantHistoryManage.value = false;
    // 空会话同样交给欢迎页展示，不写入占位气泡。
    assistantMessages.value = [...result.messages].reverse().map((message) => ({
      role: message.role,
      text: message.content,
      attachments: message.attachments
    }));
  }

  async function startNewAssistantConversation() {
    const result = await createAssistantConversation();
    activeConversationId.value = result.conversation.id;
    assistantConversations.value = [result.conversation, ...assistantConversations.value];
    assistantHistoryOpen.value = false;
    assistantHistoryManage.value = false;
    // 新建会话的欢迎页交给 AssistantPanel 渲染，这里保持消息列表为空。
    assistantMessages.value = [];
    assistantOpen.value = true;
  }

  function toggleAssistantHistory() {
    assistantHistoryOpen.value = !assistantHistoryOpen.value;
    assistantHistoryManage.value = false;
    selectedConversationIds.value = new Set();
    historySearchInput.value = "";
  }

  function toggleConversationSelected(conversationId: string) {
    const next = new Set(selectedConversationIds.value);
    if (next.has(conversationId)) {
      next.delete(conversationId);
    } else {
      next.add(conversationId);
    }
    selectedConversationIds.value = next;
  }

  async function removeSelectedConversations() {
    const ids = [...selectedConversationIds.value];
    if (!ids.length) {
      return;
    }

    await deleteAssistantConversations(ids);
    selectedConversationIds.value = new Set();
    await loadAssistantConversations();

    if (activeConversationId.value && ids.includes(activeConversationId.value)) {
      activeConversationId.value = null;
      assistantMessages.value = [{
        role: "assistant",
        text: "历史记录已删除，可以开始新的对话。"
      }];
    }
  }

  async function attachAssistantFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) {
      return;
    }

    const currentSize = assistantAttachments.value.reduce((sum, item) => sum + item.size, 0);
    let acceptedSize = currentSize;
    const remainingSlots = maxAttachmentCount - assistantAttachments.value.length;
    const acceptedFiles = nextFiles.slice(0, Math.max(0, remainingSlots)).filter((file) => {
      if (file.size > maxAttachmentSize || acceptedSize + file.size > maxAttachmentTotalSize) {
        return false;
      }
      acceptedSize += file.size;
      return true;
    });

    if (!acceptedFiles.length) {
      addAssistantNotice("附件数量或体积超过限制：最多 6 个文件，单个不超过 20MB，总计不超过 60MB。");
      return;
    }

    let attachments: AssistantAttachment[];
    try {
      attachments = await Promise.all(acceptedFiles.map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name || "未命名附件",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
        kind: getAttachmentKind(file.type || "")
      })));
    } catch {
      addAssistantNotice("附件读取失败，请重新选择文件。");
      return;
    }

    assistantAttachments.value = [...assistantAttachments.value, ...attachments];

    if (acceptedFiles.length < nextFiles.length) {
      addAssistantNotice("部分附件因为数量或体积限制没有添加。");
    }
  }

  function removeAssistantAttachment(attachmentId: string) {
    assistantAttachments.value = assistantAttachments.value.filter((item) => item.id !== attachmentId);
  }

  async function askAssistant() {
    const message = assistantInput.value.trim();
    if (!message && assistantAttachments.value.length === 0) {
      return;
    }

    if (isAssistantLoading.value) {
      return;
    }

    const attachments = [...assistantAttachments.value];
    assistantMessages.value.unshift({ role: "user", text: message || "请分析这些附件。", attachments });
    assistantMessages.value.unshift({ role: "assistant", text: "", reasoningCollapsed: false, streaming: true });
    assistantInput.value = "";
    assistantAttachments.value = [];
    assistantOpen.value = true;
    isAssistantLoading.value = true;

    try {
      currentAbortController = new AbortController();
      const assistantMessage = assistantMessages.value[0];
      await streamAssistantMessage({
        conversationId: activeConversationId.value ?? undefined,
        message: message || "请分析这些附件。",
        activeCategory: options.getActiveCategory?.(),
        attachments,
        model: assistantModel.value || undefined,
        effort: assistantEffort.value
      }, {
        onMeta(data) {
          activeConversationId.value = data.conversation.id;
          if (!assistantConversations.value.some((conversation) => conversation.id === data.conversation.id)) {
            assistantConversations.value.unshift(data.conversation);
          }
        },
        onReasoning(data) {
          assistantMessage.reasoningCollapsed = false;
          assistantMessage.reasoning = `${assistantMessage.reasoning ?? ""}${data.text}`;
        },
        onDelta(data) {
          assistantMessage.text += data.text;
        },
        onDone(response) {
          assistantMessage.streaming = false;
          assistantMessage.reasoningCollapsed = Boolean(assistantMessage.reasoning);
          assistantMessage.text = response.message || assistantMessage.text;
          assistantMessage.results = response.results ?? (response.bookmark ? [response.bookmark] : undefined);
          assistantMessage.confirmationRequest = response.action;
          if (response.conversation) {
            assistantConversations.value = [
              response.conversation,
              ...assistantConversations.value.filter((conversation) => conversation.id !== response.conversation?.id)
            ];
          }
          if (response.type === "bookmark_saved" || response.changed) {
            options.loadBookmarks();
          }
          if (response.categoriesChanged) {
            options.loadCategories?.();
          }
        },
        onError(messageText) {
          assistantMessage.streaming = false;
          assistantMessage.reasoningCollapsed = Boolean(assistantMessage.reasoning);
          assistantMessage.text = messageText;
        }
      }, { signal: currentAbortController.signal });
      await loadAssistantConversations();
    } catch (error: any) {
      if (error.name === "AbortError") {
        assistantMessages.value[0].text += " [已终止]";
      } else {
        assistantMessages.value[0] = {
          role: "assistant",
          text: error instanceof Error ? error.message : "助手暂时不可用"
        };
      }
    } finally {
      currentAbortController = null;
      assistantMessages.value[0].streaming = false;
      assistantMessages.value[0].reasoningCollapsed = Boolean(assistantMessages.value[0].reasoning);
      isAssistantLoading.value = false;
    }
  }

  function toggleReasoningCollapsed(index: number) {
    if (assistantMessages.value[index]) {
      assistantMessages.value[index].reasoningCollapsed = !assistantMessages.value[index].reasoningCollapsed;
    }
  }

  function stopAssistant() {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
  }

  return {
    assistantInput,
    assistantOpen,
    assistantModel,
    assistantEffort,
    assistantEffortOptions,
    modelSelectOpen,
    effortSelectOpen,
    assistantConversations,
    activeConversationId,
    assistantHistoryOpen,
    assistantHistoryManage,
    selectedConversationIds,
    historySearchInput,
    assistantMessages,
    assistantAttachments,
    isAssistantLoading,
    activeConversation,
    filteredAssistantConversations,
    addAssistantNotice,
    toggleModelSelect,
    toggleEffortSelect,
    closeDropdowns,
    loadAssistantConversations,
    openAssistantConversation,
    startNewAssistantConversation,
    toggleAssistantHistory,
    toggleConversationSelected,
    removeSelectedConversations,
    attachAssistantFiles,
    removeAssistantAttachment,
    askAssistant,
    stopAssistant,
    toggleReasoningCollapsed
  };
}
