<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronDown, FileText, History, Loader2, Mic, Plus, Search, Send, Square, SquareTerminal, Video, X, Link, Image as ImageIcon, Check, Pencil, Trash2, Tag } from "@lucide/vue";
import type { AssistantUiMessage } from "../../composables/useAssistant";
import type { AiModelConfig, AssistantAttachment, AssistantConversation, Bookmark, Category } from "../../types";
import { listBookmarks, listCategories } from "../../api";
import { renderAssistantMarkdown } from "../../utils/markdown";

const props = defineProps<{
  isSettingsPage: boolean;
  activeConversation?: AssistantConversation;
  filteredConversations: AssistantConversation[];
  activeConversationId: string | null;
  selectedConversationIds: Set<string>;
  assistantMessages: AssistantUiMessage[];
  assistantAttachments: AssistantAttachment[];
  isAssistantLoading: boolean;
  assistantEffortOptions: string[];
  availableModels: AiModelConfig[];
}>();

const { t } = useI18n();

const assistantOpen = defineModel<boolean>("assistantOpen", { required: true });
const assistantHistoryOpen = defineModel<boolean>("assistantHistoryOpen", { required: true });
const assistantHistoryManage = defineModel<boolean>("assistantHistoryManage", { required: true });
const historySearchInput = defineModel<string>("historySearchInput", { required: true });
const assistantInput = defineModel<string>("assistantInput", { required: true });
const assistantModel = defineModel<string>("assistantModel", { required: true });
const assistantEffort = defineModel<string>("assistantEffort", { required: true });
const modelSelectOpen = defineModel<boolean>("modelSelectOpen", { required: true });
const effortSelectOpen = defineModel<boolean>("effortSelectOpen", { required: true });

const emit = defineEmits<{
  askAssistant: [];
  toggleAssistantHistory: [];
  startNewAssistantConversation: [];
  toggleConversationSelected: [conversationId: string];
  openAssistantConversation: [conversationId: string];
  removeSelectedConversations: [];
  renameAssistantConversation: [conversationId: string, title: string];
  removeAssistantConversation: [conversationId: string];
  attachAssistantFiles: [files: FileList];
  removeAssistantAttachment: [attachmentId: string];
  toggleModelSelect: [event: Event];
  toggleEffortSelect: [event: Event];
  toggleReasoningCollapsed: [index: number];
  stopAssistant: [];
}>();

const effortMap: Record<string, string> = {
  "关闭": "none",
  "默认": "default",
  "低": "low",
  "中": "medium",
  "高": "high",
  "最大": "max"
};

function getEffortLabel(effort: string) {
  const key = effortMap[effort];
  return key ? t(`assistant.effort.${key}`) : effort;
}

// 流式场景下，文本会逐字追加，computed 会重新解析带最新片段的 markdown。
// 用户消息保持纯文本——前端永远不应该把用户输入当 markdown 渲染。
const renderedMessages = computed(() =>
  props.assistantMessages.map((message) => ({
    ...message,
    html: message.role === "assistant" ? renderAssistantMarkdown(message.text) : ""
  }))
);

const selectedModelSupportsVision = computed(() => {
  if (!assistantModel.value) return false;
  const model = props.availableModels.find(m => m.name === assistantModel.value);
  return model ? model.supportsVision : false;
});

interface RichTextSegment {
  type: 'text' | 'command' | 'bookmark' | 'category';
  text?: string;
  name?: string;
  id?: string;
}

function parseRichTextSegments(text: string) {
  const segments: RichTextSegment[] = [];
  let rest = text;
  const regex = /(\/[\w\u4e00-\u9fa5-]+ )|(@\[.*?\]\(.*?\))|(\$\[.*?\]\(.*?\))/;
  while (true) {
    const match = rest.match(regex);
    if (!match) {
      if (rest) segments.push({ type: 'text', text: rest });
      break;
    }
    if (match.index! > 0) {
      segments.push({ type: 'text', text: rest.substring(0, match.index) });
    }
    if (match[1]) {
      if (isKnownSlashCommand(match[1])) {
        segments.push({ type: 'command', name: match[1] });
      } else {
        segments.push({ type: 'text', text: match[1] });
      }
    } else if (match[2]) {
      const mentionMatch = match[2].match(/^@\[(.*?)\]\((.*?)\)/);
      if (mentionMatch) {
        segments.push({ type: 'bookmark', name: mentionMatch[1], id: mentionMatch[2] });
      }
    } else if (match[3]) {
      const catMatch = match[3].match(/^\$\[(.*?)\]\((.*?)\)/);
      if (catMatch) {
        segments.push({ type: 'category', name: catMatch[1], id: catMatch[2] });
      }
    }
    rest = rest.substring(match.index! + match[0].length);
  }
  return segments;
}

const editorRef = ref<HTMLElement | null>(null);
const showCommandMenu = ref(false);
const showMentionMenu = ref(false);
const currentSearchText = ref("");
const editingConversationId = ref<string | null>(null);
const editingConversationTitle = ref("");

function normalizeSlashCommandName(value: string) {
  return value.trim().toLowerCase();
}

function getMatchedSlashCommands(query: string) {
  const normalizedQuery = normalizeSlashCommandName(query);
  return slashCommands.value.filter((cmd) => normalizeSlashCommandName(cmd.name).startsWith(normalizedQuery));
}

function isKnownSlashCommand(value: string) {
  const normalizedValue = normalizeSlashCommandName(value);
  return slashCommands.value.some((cmd) => normalizeSlashCommandName(cmd.name) === normalizedValue);
}

function openHistoryConversation(conversationId: string) {
  if (assistantHistoryManage.value || editingConversationId.value) {
    return;
  }

  emit("openAssistantConversation", conversationId);
}

function startEditingConversation(conversation: AssistantConversation) {
  editingConversationId.value = conversation.id;
  editingConversationTitle.value = conversation.title;
}

function cancelEditingConversation() {
  editingConversationId.value = null;
  editingConversationTitle.value = "";
}

function saveEditingConversation() {
  if (!editingConversationId.value) {
    return;
  }

  const title = editingConversationTitle.value.replace(/\s+/g, " ").trim();
  if (!title) {
    return;
  }

  emit("renameAssistantConversation", editingConversationId.value, title);
  cancelEditingConversation();
}

function removeHistoryConversation(conversation: AssistantConversation) {
  if (!window.confirm(`删除历史记录“${conversation.title}”？`)) {
    return;
  }

  emit("removeAssistantConversation", conversation.id);
}

function confirmAction(action: string, index: number) {
  if (props.isAssistantLoading) return;
  if (props.assistantMessages[index]) {
    delete props.assistantMessages[index].confirmationRequest;
  }
  assistantInput.value = action;
  emit('askAssistant');
}

function cancelAction(index: number) {
  if (props.isAssistantLoading) return;
  if (props.assistantMessages[index]) {
    delete props.assistantMessages[index].confirmationRequest;
  }
  assistantInput.value = "取消执行";
  emit('askAssistant');
}
// 保存触发菜单时的光标位置，确保点击菜单项时仍能正确插入徽章
let savedRange: Range | null = null;

function checkMenuTrigger() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editorRef.value?.contains(sel.anchorNode)) {
    showCommandMenu.value = false;
    showMentionMenu.value = false;
    return;
  }
  
  const node = sel.anchorNode;
  if (node && node.nodeType === Node.TEXT_NODE) {
    const textBeforeCursor = node.textContent?.substring(0, sel.anchorOffset) || "";
    
    const commandMatch = textBeforeCursor.match(/(?:^|\s)(\/[\w\u4e00-\u9fa5-]*)$/);
    if (commandMatch && getMatchedSlashCommands(commandMatch[1]).length > 0) {
      showCommandMenu.value = true;
      showMentionMenu.value = false;
      currentSearchText.value = commandMatch[1].toLowerCase();
      // 保存当前光标位置
      savedRange = sel.getRangeAt(0).cloneRange();
      return;
    }
    
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^@\s]*)$/);
    if (mentionMatch) {
      showMentionMenu.value = true;
      showCommandMenu.value = false;
      currentSearchText.value = mentionMatch[1].toLowerCase();
      // 保存当前光标位置
      savedRange = sel.getRangeAt(0).cloneRange();
      return;
    }
  }
  
  showCommandMenu.value = false;
  showMentionMenu.value = false;
}

function extractTextFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    if (el.classList.contains('mention-badge')) {
      const type = el.dataset.type;
      const id = el.dataset.id;
      const name = el.dataset.name;
      return type === 'bookmark' ? `@[${name}](${id})` : `$[${name}](${id})`;
    } else if (el.classList.contains('command-badge')) {
      return el.dataset.name || "";
    } else if (el.nodeName === 'BR') {
      return "\n";
    } else {
      let text = "";
      for (const child of node.childNodes) {
        text += extractTextFromNode(child);
      }
      if (el.nodeName === 'DIV' || el.nodeName === 'P') {
        return "\n" + text;
      }
      return text;
    }
  }
  return "";
}

function onEditorInput() {
  if (!editorRef.value) return;
  let text = "";
  for (const node of editorRef.value.childNodes) {
    const nodeText = extractTextFromNode(node);
    if (node === editorRef.value.firstChild && (node.nodeName === 'DIV' || node.nodeName === 'P') && nodeText.startsWith('\n')) {
      text += nodeText.substring(1);
    } else {
      text += nodeText;
    }
  }
  assistantInput.value = text;
  checkMenuTrigger();
}

watch(() => assistantInput.value, (newVal) => {
  if (!editorRef.value) return;
  if (newVal === "") {
    editorRef.value.innerHTML = "";
  }
});

const assistantPanelWidth = ref(420);
const isResizingAssistant = ref(false);
const isAssistantInputComposing = ref(false);
const shouldIgnoreNextEnter = ref(false);
const attachmentInputRef = ref<HTMLInputElement | null>(null);
const panelWidthStyle = computed(() => ({
  width: `${assistantPanelWidth.value}px`
}));

const panelWidthStorageKey = "linka-assistant-panel-width";

function clampPanelWidth(width: number) {
  const maxWidth = Math.min(window.innerWidth - 72, 860);
  return Math.min(Math.max(width, 340), Math.max(340, maxWidth));
}

function onAssistantResizeMove(event: PointerEvent) {
  if (!isResizingAssistant.value) {
    return;
  }

  assistantPanelWidth.value = clampPanelWidth(window.innerWidth - event.clientX);
}

function stopAssistantResize() {
  if (!isResizingAssistant.value) {
    return;
  }

  isResizingAssistant.value = false;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  window.localStorage.setItem(panelWidthStorageKey, String(assistantPanelWidth.value));
  window.removeEventListener("pointermove", onAssistantResizeMove);
  window.removeEventListener("pointerup", stopAssistantResize);
}

function startAssistantResize(event: PointerEvent) {
  if (window.innerWidth <= 768) {
    return;
  }

  event.preventDefault();
  isResizingAssistant.value = true;
  document.body.style.cursor = "ew-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onAssistantResizeMove);
  window.addEventListener("pointerup", stopAssistantResize);
}

onMounted(() => {
  const savedWidth = Number(window.localStorage.getItem(panelWidthStorageKey));
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    assistantPanelWidth.value = clampPanelWidth(savedWidth);
  }
});

onUnmounted(() => {
  stopAssistantResize();
});


interface SlashCommand {
  name: string;
  description: string;
  template: string;
}

const slashCommands = computed<SlashCommand[]>(() => [
  { name: t('assistant.commands.addBookmark'), description: t('assistant.commands.addBookmarkDesc'), template: `${t('assistant.commands.addBookmark')} ` },
  { name: t('assistant.commands.delBookmark'), description: t('assistant.commands.delBookmarkDesc'), template: `${t('assistant.commands.delBookmark')} ` },
  { name: t('assistant.commands.addCategory'), description: t('assistant.commands.addCategoryDesc'), template: `${t('assistant.commands.addCategory')} ` },
  { name: t('assistant.commands.delCategory'), description: t('assistant.commands.delCategoryDesc'), template: `${t('assistant.commands.delCategory')} ` },
  { name: t('assistant.commands.searchWeb'), description: t('assistant.commands.searchWebDesc'), template: `${t('assistant.commands.searchWeb')} ` },
  { name: t('assistant.commands.fetchWeb'), description: t('assistant.commands.fetchWebDesc'), template: `${t('assistant.commands.fetchWeb')} ` },
]);

const matchedCommands = computed(() => {
  if (!showCommandMenu.value) return [];
  return getMatchedSlashCommands(currentSearchText.value);
});

const selectedCommandIndex = ref(0);

watch(matchedCommands, () => {
  selectedCommandIndex.value = 0;
});

const matchedBookmarks = ref<Bookmark[]>([]);
const allCategories = ref<Category[]>([]);
const matchedCategories = computed(() => {
  if (!currentSearchText.value) return allCategories.value;
  return allCategories.value.filter(c => c.name.toLowerCase().includes(currentSearchText.value));
});

type CombinedMention = { type: 'bookmark'; data: Bookmark } | { type: 'category'; data: Category };

const combinedMentions = computed<CombinedMention[]>(() => {
  if (!showMentionMenu.value) return [];
  const options: CombinedMention[] = [];
  matchedBookmarks.value.forEach(b => options.push({ type: 'bookmark', data: b }));
  matchedCategories.value.forEach(c => options.push({ type: 'category', data: c }));
  return options;
});

const selectedMentionIndex = ref(0);

watch([showMentionMenu, currentSearchText], async ([show, val]) => {
  selectedMentionIndex.value = 0;
  if (show) {
    if (allCategories.value.length === 0) {
      try {
        const catRes = await listCategories();
        allCategories.value = catRes.categories;
      } catch (e) {
        console.error("Failed to fetch categories", e);
      }
    }

    const params = new URLSearchParams();
    if (val) {
      params.append("q", val as string);
    }
    params.append("limit", "10");
    try {
      const res = await listBookmarks(params);
      matchedBookmarks.value = res.bookmarks;
    } catch (e) {
      console.error("Failed to fetch bookmarks for mention", e);
      matchedBookmarks.value = [];
    }
  } else {
    matchedBookmarks.value = [];
  }
});

function onCommandKeydown(event: KeyboardEvent) {
  // 命令菜单打开时拦截方向键、Tab 和 Escape
  // 注意：Enter 键由 onAssistantInputEnter 统一处理，这里不能处理 Enter
  // 否则会先关闭菜单再触发 onAssistantInputEnter，导致消息被误发送
  if (showCommandMenu.value) {
    if (matchedCommands.value.length > 0) {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectedCommandIndex.value = (selectedCommandIndex.value - 1 + matchedCommands.value.length) % matchedCommands.value.length;
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        selectedCommandIndex.value = (selectedCommandIndex.value + 1) % matchedCommands.value.length;
      } else if (event.key === "Tab") {
        event.preventDefault();
        applyCommand(matchedCommands.value[selectedCommandIndex.value]);
      }
    } else if (event.key === "Tab") {
      event.preventDefault();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      showCommandMenu.value = false;
      savedRange = null;
    }
    return;
  }

  // @ 提及菜单打开时拦截方向键、Tab 和 Escape
  if (showMentionMenu.value) {
    if (combinedMentions.value.length > 0) {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectedMentionIndex.value = (selectedMentionIndex.value - 1 + combinedMentions.value.length) % combinedMentions.value.length;
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        selectedMentionIndex.value = (selectedMentionIndex.value + 1) % combinedMentions.value.length;
      } else if (event.key === "Tab") {
        event.preventDefault();
        applyCombinedMention(combinedMentions.value[selectedMentionIndex.value]);
      }
    } else if (event.key === "Tab") {
      event.preventDefault();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      showMentionMenu.value = false;
      savedRange = null;
    }
    return;
  }
}

function insertBadge(html: string) {
  if (!editorRef.value) return;
  // 确保编辑器拥有焦点
  editorRef.value.focus();

  // 优先使用保存的光标位置（点击菜单项时当前选区可能已丢失）
  let range: Range | null = null;
  const sel = window.getSelection();
  if (savedRange && editorRef.value.contains(savedRange.startContainer)) {
    range = savedRange;
  } else if (sel && sel.rangeCount > 0) {
    range = sel.getRangeAt(0);
  }
  if (!range) return;

  const node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || "";
    const offset = range.startOffset;
    const textBeforeCursor = text.substring(0, offset);
    
    let matchIndex = textBeforeCursor.search(/(?:^|\s)[@\/][^@\s\/]*$/);
    if (matchIndex !== -1) {
      if (textBeforeCursor[matchIndex] === ' ' || textBeforeCursor[matchIndex] === '\n') {
        matchIndex++;
      }
      range.setStart(node, matchIndex);
      range.setEnd(node, offset);
      range.deleteContents();
      
      const badgeFragment = document.createElement("template");
      badgeFragment.innerHTML = html;
      const el = badgeFragment.content.firstChild as HTMLElement;
      range.insertNode(el);
      
      range.setStartAfter(el);
      range.setEndAfter(el);
      
      const space = document.createTextNode(" ");
      range.insertNode(space);
      range.setStartAfter(space);
      range.collapse(true);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      
      // 清除已使用的保存位置
      savedRange = null;
      onEditorInput();
      return;
    }
  }
  // 插入失败时也清除保存位置
  savedRange = null;
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function applyCommand(cmd: SlashCommand) {
  // 先关闭菜单，防止后续 Enter 事件二次触发
  showCommandMenu.value = false;
  const name = escapeHtml(cmd.template);
  const display = escapeHtml(cmd.template.substring(1));
  insertBadge(`<span class="active-command-badge command-badge" contenteditable="false" data-name="${name}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-terminal"><path d="m7 11 2-2-2-2"/><path d="M11 13h4"/><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/></svg>${display}</span>`);
}

function applyCombinedMention(option: CombinedMention) {
  // 先关闭菜单，防止后续 Enter 事件二次触发
  showMentionMenu.value = false;
  if (option.type === "bookmark") {
    const title = escapeHtml(option.data.title);
    const id = escapeHtml(option.data.id);
    insertBadge(`<span class="active-command-badge mention-badge" contenteditable="false" data-type="bookmark" data-name="${title}" data-id="${id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>${title}</span>`);
  } else {
    const name = escapeHtml(option.data.name);
    const id = escapeHtml(option.data.id);
    insertBadge(`<span class="active-command-badge mention-badge" contenteditable="false" data-type="category" data-name="${name}" data-id="${id}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tag"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>${name}</span>`);
  }
}

function onAssistantInputCompositionStart() {
  isAssistantInputComposing.value = true;
}

function onAssistantInputCompositionEnd() {
  isAssistantInputComposing.value = false;
  shouldIgnoreNextEnter.value = true;
  window.setTimeout(() => {
    shouldIgnoreNextEnter.value = false;
  }, 80);
}

function onAssistantInputEnter(event: KeyboardEvent) {
  if (event.isComposing || isAssistantInputComposing.value || event.keyCode === 229) {
    return;
  }

  // 任何菜单打开时，一律拦截 Enter，绝不发送消息
  if (showCommandMenu.value) {
    event.preventDefault();
    if (matchedCommands.value.length > 0) {
      applyCommand(matchedCommands.value[selectedCommandIndex.value]);
    }
    return;
  }

  if (showMentionMenu.value) {
    event.preventDefault();
    if (combinedMentions.value.length > 0) {
      applyCombinedMention(combinedMentions.value[selectedMentionIndex.value]);
    }
    return;
  }

  if (shouldIgnoreNextEnter.value) {
    event.preventDefault();
    shouldIgnoreNextEnter.value = false;
    return;
  }

  event.preventDefault();
  emit("askAssistant");
}

function triggerAttachmentPicker() {
  attachmentInputRef.value?.click();
}

function onAttachmentInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) {
    emit("attachAssistantFiles", input.files);
  }
  input.value = "";
}

function onInputPaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return;

  const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
  if (imageItems.length > 0) {
    const files = imageItems.map(item => item.getAsFile()).filter((file): file is File => file !== null);
    if (files.length > 0) {
      const dataTransfer = new DataTransfer();
      files.forEach(file => dataTransfer.items.add(file));
      emit("attachAssistantFiles", dataTransfer.files);
      event.preventDefault();
      return;
    }
  }

  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain");
  if (text) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      onEditorInput();
    }
  }
}

function focusEditor() {
  if (editorRef.value) {
    editorRef.value.focus();
  }
}

const isDraggingOver = ref(false);

function onDragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes('Files')) {
    isDraggingOver.value = true;
  }
}

function onDragLeave(event: DragEvent) {
  const currentTarget = event.currentTarget as HTMLElement;
  const rect = currentTarget.getBoundingClientRect();
  if (
    event.clientX <= rect.left ||
    event.clientX >= rect.right ||
    event.clientY <= rect.top ||
    event.clientY >= rect.bottom
  ) {
    isDraggingOver.value = false;
  }
}

function onDrop(event: DragEvent) {
  isDraggingOver.value = false;
  if (event.dataTransfer?.files.length) {
    emit("attachAssistantFiles", event.dataTransfer.files);
  }
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const previewImageUrl = ref<string | null>(null);
</script>

<template>
  <button class="assistant-fab" :title="t('assistant.summon')" @click="assistantOpen = true"
    v-show="!assistantOpen && !isSettingsPage">
    <img src="/assistant-bot.png" alt="Linka AI" />
  </button>

  <transition name="fade">
    <aside v-if="assistantOpen && !isSettingsPage" class="assistant-panel" :style="panelWidthStyle"
      :class="{ resizing: isResizingAssistant }">
      <div class="assistant-resize-handle" :title="t('assistant.dragResize')" :aria-label="t('assistant.dragResizeAria')"
        @pointerdown="startAssistantResize"></div>
      <div class="assistant-header">
        <div class="brand-icon assistant-brand-icon">
          <img src="/assistant-bot.png" alt="Linka AI" />
        </div>
        <div class="assistant-header-text">
          <h2>Linka AI</h2>
        </div>
        <div class="header-actions">
          <button class="tool-btn" :title="t('assistant.history')" :class="{ active: assistantHistoryOpen }"
            @click="$emit('toggleAssistantHistory')">
            <History :size="18" />
          </button>
          <button class="tool-btn" :title="t('assistant.newConversation')" @click="$emit('startNewAssistantConversation')">
            <Plus :size="18" />
          </button>
        </div>
        <button class="btn-close" :title="t('assistant.close')" @click="assistantOpen = false">
          <X :size="20" />
        </button>
      </div>

      <div v-if="assistantHistoryOpen" class="assistant-history-page">
        <div class="history-search">
          <Search :size="16" />
          <input v-model="historySearchInput" :placeholder="t('assistant.searchHistory')" />
        </div>
        <div class="history-actions">
          <span>{{ t('assistant.history') }}</span>
          <button class="mini-button" @click="assistantHistoryManage = !assistantHistoryManage">
            {{ assistantHistoryManage ? t('assistant.done') : t('assistant.manage') }}
          </button>
        </div>
        <div class="history-list">
          <div v-for="conversation in filteredConversations" :key="conversation.id" class="history-item"
            :class="{ active: activeConversationId === conversation.id }"
            role="button"
            tabindex="0"
            @click="openHistoryConversation(conversation.id)"
            @keydown.enter.prevent="openHistoryConversation(conversation.id)">
            <input v-if="assistantHistoryManage" type="checkbox" :checked="selectedConversationIds.has(conversation.id)"
              @click.stop="$emit('toggleConversationSelected', conversation.id)" />
            <div class="history-item-main">
              <form v-if="editingConversationId === conversation.id" class="history-title-edit" @submit.prevent.stop="saveEditingConversation">
                <input
                  v-model="editingConversationTitle"
                  maxlength="80"
                  autofocus
                  @click.stop
                  @keydown.enter.prevent.stop="saveEditingConversation"
                  @keydown.esc.prevent.stop="cancelEditingConversation"
                />
                <button type="submit" class="history-icon-btn" title="保存标题" @click.stop>
                  <Check :size="15" />
                </button>
                <button type="button" class="history-icon-btn" title="取消修改" @click.stop="cancelEditingConversation">
                  <X :size="15" />
                </button>
              </form>
              <template v-else>
                <strong>{{ conversation.title }}</strong>
                <span>{{ new Date(conversation.updatedAt).toLocaleString() }}</span>
              </template>
            </div>
            <div v-if="!assistantHistoryManage && editingConversationId !== conversation.id" class="history-item-actions">
              <button type="button" class="history-icon-btn" title="修改标题" @click.stop="startEditingConversation(conversation)">
                <Pencil :size="15" />
              </button>
              <button type="button" class="history-icon-btn danger" title="删除历史记录" @click.stop="removeHistoryConversation(conversation)">
                <Trash2 :size="15" />
              </button>
            </div>
          </div>
          <div v-if="filteredConversations.length === 0" class="history-empty">
            {{ t('assistant.emptyHistory') }}
          </div>
        </div>
        <div class="history-manage-bar" v-if="assistantHistoryManage">
          <span>{{ t('assistant.selected') }}{{ selectedConversationIds.size }}{{ t('assistant.items') }}</span>
          <button class="mini-button danger" :disabled="selectedConversationIds.size === 0"
            @click="$emit('removeSelectedConversations')">
            {{ t('assistant.batchDelete') }}
          </button>
        </div>
      </div>

      <div v-else class="message-list">
        <div v-if="assistantMessages.length === 0" class="assistant-welcome">
          <div class="welcome-avatar">
            <img src="/assistant-bot.png" alt="Linka AI" />
          </div>
          <h3>{{ t('assistant.welcome') }}</h3>
        </div>
        <div v-for="(message, index) in renderedMessages" :key="index" class="message" :class="message.role">
          <div class="message-content">
            <div v-if="message.reasoning" class="message-reasoning" :class="{ collapsed: message.reasoningCollapsed }">
              <button class="message-reasoning-toggle" type="button"
                @click="$emit('toggleReasoningCollapsed', index)">
                <span>{{ message.streaming ? t('assistant.thinking') : t('assistant.thoughtDone') }}</span>
                <ChevronDown :size="14" />
              </button>
              <p v-if="!message.reasoningCollapsed">{{ message.reasoning }}<span v-if="message.streaming && !message.text"
                  class="stream-cursor"></span></p>
            </div>
            <!-- assistant 消息走 markdown 渲染（已经过 XSS 过滤），user 消息保持纯文本。 -->
            <div v-if="message.role === 'assistant' && message.streaming && !message.text && !message.reasoning"
              class="assistant-waiting" :aria-label="t('assistant.processingAria')">
              <span v-if="message.statusText" class="assistant-status-text">{{ message.statusText }}</span>
              <template v-else>
                <span></span>
                <span></span>
                <span></span>
              </template>
            </div>
            <div v-else-if="message.role === 'assistant' && (message.text || !message.reasoning)" class="markdown-body"
              v-html="message.html || message.text"></div>
            <p v-else-if="message.text || !message.reasoning">
              <template v-for="(seg, i) in parseRichTextSegments(message.text)" :key="i">
                <span v-if="seg.type === 'command'" class="user-slash-command">
                  <SquareTerminal :size="16" />
                  {{ seg.name!.substring(1) }}
                </span>
                <span v-else-if="seg.type === 'bookmark' || seg.type === 'category'" class="user-slash-command mention-badge">
                  <Link v-if="seg.type === 'bookmark'" :size="16" />
                  <Tag v-else :size="16" />
                  {{ seg.name }}
                </span>
                <template v-else>
                  {{ seg.text }}
                </template>
              </template>
              <span v-if="message.streaming" class="stream-cursor"></span>
            </p>
            <div v-if="message.attachments?.length" class="attachment-list message-attachment-list">
              <div v-for="attachment in message.attachments" :key="attachment.id" class="attachment-chip readonly"
                :class="{ image: attachment.kind === 'image' }">
                <img v-if="attachment.kind === 'image'" :src="attachment.dataUrl" :alt="attachment.name"
                  @click="previewImageUrl = attachment.dataUrl" class="previewable-image" />
                <div v-else class="attachment-icon">
                  <Video v-if="attachment.kind === 'video'" :size="16" />
                  <FileText v-else :size="16" />
                </div>
                <div v-if="attachment.kind !== 'image'" class="attachment-meta">
                  <strong>{{ attachment.name }}</strong>
                  <span>{{ formatFileSize(attachment.size) }}</span>
                </div>
              </div>
            </div>
            <div v-if="message.results?.length" class="result-list">
              <a v-for="result in message.results" :key="result.id" :href="result.url" target="_blank" rel="noreferrer">
                {{ result.title }}
                <span>{{ result.category }}</span>
              </a>
            </div>
            <div v-if="message.confirmationRequest" class="confirmation-card">
              <button class="btn-primary" :disabled="isAssistantLoading" @click="confirmAction(message.confirmationRequest, index)">
                <Check :size="16" />
                {{ message.confirmationRequest }}
              </button>
              <button class="btn-secondary" :disabled="isAssistantLoading" @click="cancelAction(index)">
                <X :size="16" />
                {{ t('assistant.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="assistant-input-wrapper" v-if="!assistantHistoryOpen" 
        :class="{ 'is-loading': isAssistantLoading, 'drag-over': isDraggingOver }"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop">
        <div class="siri-glow-wave"></div>
        <div class="input-box-container" @click="focusEditor">
          <div
            ref="editorRef"
            contenteditable="true"
            class="rich-input-editor"
            :data-placeholder="t('assistant.inputPlaceholder')"
            @input="onEditorInput"
            @compositionstart="onAssistantInputCompositionStart"
            @compositionend="onAssistantInputCompositionEnd"
            @keydown="onCommandKeydown"
            @keydown.enter.exact.prevent="onAssistantInputEnter"
            @paste="onInputPaste"
          ></div>
        </div>
        
        <transition name="fade">
          <div v-if="showCommandMenu" class="command-menu">
            <div v-if="matchedCommands.length === 0" class="command-menu-empty">
              没有找到匹配的命令
            </div>
            <div v-for="(cmd, index) in matchedCommands" :key="cmd.name"
                 class="command-menu-item"
                 :class="{ active: index === selectedCommandIndex }"
                 @mousedown.prevent
                 @click="applyCommand(cmd)">
              <div class="command-name" style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
                <SquareTerminal :size="14" />
                {{ cmd.name.substring(1) }}
              </div>
              <div class="command-desc">{{ cmd.description }}</div>
            </div>
          </div>
        </transition>

        <transition name="fade">
          <div class="command-menu" v-if="showMentionMenu">
            <div v-if="combinedMentions.length === 0" class="command-menu-empty">
              {{ t('assistant.mentions.noBookmarksFound') || '没有找到匹配的书签或分类' }}
            </div>
            <template v-for="(item, index) in combinedMentions" :key="item.type + '-' + item.data.id">
              <div v-if="index === 0 || item.type !== combinedMentions[index - 1].type" class="command-menu-group-header">
                {{ item.type === 'bookmark' ? '书签' : '分类' }}
              </div>
              <div class="command-menu-item"
                   :class="{ active: index === selectedMentionIndex }"
                   @mousedown.prevent
                   @click="applyCombinedMention(item)">
                <div class="command-name" style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
                  <component :is="item.type === 'bookmark' ? Link : Tag" :size="14" />
                  {{ item.type === 'bookmark' ? (item.data as Bookmark).title : (item.data as Category).name }}
                </div>
                <div v-if="item.type === 'bookmark'" class="command-desc">{{ (item.data as Bookmark).summary || (item.data as Bookmark).url }}</div>
              </div>
            </template>
          </div>
        </transition>

        <div v-if="assistantAttachments.length" class="attachment-list input-attachment-list">
          <div v-for="attachment in assistantAttachments" :key="attachment.id" class="attachment-chip"
            :class="{ image: attachment.kind === 'image' }">
            <img v-if="attachment.kind === 'image'" :src="attachment.dataUrl" :alt="attachment.name"
              @click="previewImageUrl = attachment.dataUrl" class="previewable-image" />
            <div v-else class="attachment-icon">
              <Video v-if="attachment.kind === 'video'" :size="16" />
              <FileText v-else :size="16" />
            </div>
            <div v-if="attachment.kind !== 'image'" class="attachment-meta">
              <strong>{{ attachment.name }}</strong>
              <span>{{ formatFileSize(attachment.size) }}</span>
            </div>
            <button type="button" :title="t('assistant.removeAttachment')" @click="$emit('removeAssistantAttachment', attachment.id)">
              <X :size="14" />
            </button>
          </div>
        </div>
        <div class="input-toolbar">
          <div class="toolbar-left">
            <input ref="attachmentInputRef" class="attachment-input" type="file" multiple
              accept="image/*,video/*,application/pdf,text/plain,text/markdown,application/json,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              @change="onAttachmentInputChange" />
            <button class="tool-btn" :title="t('assistant.uploadAttachment')" @click="triggerAttachmentPicker">
              <Plus :size="18" />
            </button>
            <div class="custom-select" :class="{ open: modelSelectOpen }">
              <div class="select-trigger" @click="$emit('toggleModelSelect', $event)">
                <span>{{ assistantModel || t('assistant.defaultModel') }}</span>
                <ImageIcon v-if="selectedModelSupportsVision" :size="12" class="vision-icon" title="支持图片输入" />
                <ChevronDown :size="14" class="select-icon" />
              </div>
              <transition name="fade">
                <div class="select-dropdown" v-if="modelSelectOpen" @click.stop>
                  <div class="select-option" v-for="model in availableModels" :key="model.id"
                    @click="assistantModel = model.name; modelSelectOpen = false"
                    :class="{ active: assistantModel === model.name }">
                    <span class="model-name-text">{{ model.name }}</span>
                    <ImageIcon v-if="model.supportsVision" :size="12" class="vision-icon" title="支持图片输入" />
                  </div>
                  <div class="select-option" v-if="availableModels.length === 0"
                    @click="assistantModel = t('assistant.defaultModel'); modelSelectOpen = false">
                    {{ t('assistant.defaultModel') }}
                  </div>
                </div>
              </transition>
            </div>

            <div class="custom-select" :class="{ open: effortSelectOpen }">
              <div class="select-trigger" @click="$emit('toggleEffortSelect', $event)">
                <span>{{ getEffortLabel(assistantEffort) }}</span>
                <ChevronDown :size="14" class="select-icon" />
              </div>
              <transition name="fade">
                <div class="select-dropdown" v-if="effortSelectOpen" @click.stop>
                  <div class="select-option" v-for="effort in assistantEffortOptions" :key="effort"
                    @click="assistantEffort = effort; effortSelectOpen = false"
                    :class="{ active: assistantEffort === effort }">
                    {{ getEffortLabel(effort) }}
                  </div>
                </div>
              </transition>
            </div>
          </div>
          <div class="toolbar-right">
            <button class="tool-btn" :title="t('assistant.voiceInput')" disabled>
              <Mic :size="18" />
            </button>
            <button :class="['btn-send', { 'btn-stop': isAssistantLoading }]" :title="isAssistantLoading ? t('assistant.stop') : t('assistant.send')" @click="isAssistantLoading ? $emit('stopAssistant') : $emit('askAssistant')">
              <Square v-if="isAssistantLoading" :size="12" fill="currentColor" />
              <Send v-else :size="14" class="send-icon" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  </transition>
  
  <teleport to="body">
    <transition name="fade">
      <div v-if="previewImageUrl" class="image-preview-overlay" @click="previewImageUrl = null">
        <button class="preview-close-btn" @click="previewImageUrl = null">
          <X :size="24" />
        </button>
        <img :src="previewImageUrl" alt="Preview" @click.stop />
      </div>
    </transition>
  </teleport>
</template>
