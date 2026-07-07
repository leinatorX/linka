<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronDown, FileText, History, Loader2, Mic, Plus, Search, Send, Square, Video, X, Package } from "@lucide/vue";
import type { AssistantUiMessage } from "../../composables/useAssistant";
import type { AiModelConfig, AssistantAttachment, AssistantConversation } from "../../types";
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

function parseUserMessageCommand(text: string) {
  if (!text.startsWith("/")) return null;
  const match = text.match(/^(\/[\w\u4e00-\u9fa5-]+)(.*)/);
  if (!match) return null;
  return {
    command: match[1],
    rest: match[2]
  };
}

const inputTextRest = computed({
  get() {
    const parsed = parseUserMessageCommand(assistantInput.value);
    return parsed ? parsed.rest.trimStart() : assistantInput.value;
  },
  set(val) {
    const parsed = parseUserMessageCommand(assistantInput.value);
    if (parsed) {
      assistantInput.value = parsed.command + " " + val;
    } else {
      assistantInput.value = val;
    }
  }
});

function onInputDelete(event: KeyboardEvent) {
  const parsed = parseUserMessageCommand(assistantInput.value);
  if (parsed && inputTextRest.value.length === 0) {
    event.preventDefault();
    assistantInput.value = "";
  }
}

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
  attachAssistantFiles: [files: FileList];
  removeAssistantAttachment: [attachmentId: string];
  toggleModelSelect: [event: Event];
  toggleEffortSelect: [event: Event];
  toggleReasoningCollapsed: [index: number];
  stopAssistant: [];
}>();

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

const showCommandMenu = computed(() => {
  return assistantInput.value.startsWith("/") && !assistantInput.value.includes(" ");
});

const matchedCommands = computed(() => {
  if (!showCommandMenu.value) return [];
  const text = assistantInput.value.toLowerCase();
  return slashCommands.value.filter(cmd => cmd.name.toLowerCase().startsWith(text));
});

const selectedCommandIndex = ref(0);

watch(matchedCommands, () => {
  selectedCommandIndex.value = 0;
});

function onCommandKeydown(event: KeyboardEvent) {
  if (!showCommandMenu.value || matchedCommands.value.length === 0) {
    return;
  }

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
}

function applyCommand(cmd: SlashCommand) {
  assistantInput.value = cmd.template;
  // wait for DOM update then focus could be done if we had textarea ref, but v-model syncs it
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

  if (showCommandMenu.value && matchedCommands.value.length > 0) {
    event.preventDefault();
    applyCommand(matchedCommands.value[selectedCommandIndex.value]);
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

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
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
          <button v-for="conversation in filteredConversations" :key="conversation.id" class="history-item"
            :class="{ active: activeConversationId === conversation.id }"
            @click="assistantHistoryManage ? $emit('toggleConversationSelected', conversation.id) : $emit('openAssistantConversation', conversation.id)">
            <input v-if="assistantHistoryManage" type="checkbox" :checked="selectedConversationIds.has(conversation.id)"
              @click.stop="$emit('toggleConversationSelected', conversation.id)" />
            <div>
              <strong>{{ conversation.title }}</strong>
              <span>{{ new Date(conversation.updatedAt).toLocaleString() }}</span>
            </div>
          </button>
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
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div v-else-if="message.role === 'assistant' && (message.text || !message.reasoning)" class="markdown-body"
              v-html="message.html || message.text"></div>
            <p v-else-if="message.text || !message.reasoning">
              <template v-if="parseUserMessageCommand(message.text)">
                <span class="user-slash-command">
                  <Package :size="16" />
                  {{ parseUserMessageCommand(message.text)!.command.substring(1) }}
                </span>
                {{ parseUserMessageCommand(message.text)!.rest }}
              </template>
              <template v-else>
                {{ message.text }}
              </template>
              <span v-if="message.streaming" class="stream-cursor"></span>
            </p>
            <div v-if="message.attachments?.length" class="attachment-list message-attachment-list">
              <div v-for="attachment in message.attachments" :key="attachment.id" class="attachment-chip readonly"
                :class="{ image: attachment.kind === 'image' }">
                <img v-if="attachment.kind === 'image'" :src="attachment.dataUrl" :alt="attachment.name" />
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
          </div>
        </div>
      </div>

      <div class="assistant-input-wrapper" v-if="!assistantHistoryOpen" :class="{ 'is-loading': isAssistantLoading }">
        <div class="siri-glow-wave"></div>
        <div class="input-box-container">
          <div v-if="parseUserMessageCommand(assistantInput)" class="active-command-badge">
            <Package :size="14" />
            {{ parseUserMessageCommand(assistantInput)!.command.substring(1) }}
          </div>
          <textarea v-model="inputTextRest" :placeholder="t('assistant.inputPlaceholder')"
            @compositionstart="onAssistantInputCompositionStart"
            @compositionend="onAssistantInputCompositionEnd"
            @keydown="onCommandKeydown"
            @keydown.delete="onInputDelete"
            @keydown.enter.exact="onAssistantInputEnter"></textarea>
        </div>
        
        <transition name="fade">
          <div v-if="showCommandMenu" class="command-menu">
            <div v-if="matchedCommands.length === 0" class="command-menu-empty">
              没有找到匹配的命令
            </div>
            <div v-for="(cmd, index) in matchedCommands" :key="cmd.name"
                 class="command-menu-item"
                 :class="{ active: index === selectedCommandIndex }"
                 @click="applyCommand(cmd)">
              <div class="command-name">{{ cmd.name }}</div>
              <div class="command-desc">{{ cmd.description }}</div>
            </div>
          </div>
        </transition>
        <div v-if="assistantAttachments.length" class="attachment-list input-attachment-list">
          <div v-for="attachment in assistantAttachments" :key="attachment.id" class="attachment-chip"
            :class="{ image: attachment.kind === 'image' }">
            <img v-if="attachment.kind === 'image'" :src="attachment.dataUrl" :alt="attachment.name" />
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
                <ChevronDown :size="14" class="select-icon" />
              </div>
              <transition name="fade">
                <div class="select-dropdown" v-if="modelSelectOpen" @click.stop>
                  <div class="select-option" v-for="model in availableModels" :key="model.id"
                    @click="assistantModel = model.name; modelSelectOpen = false"
                    :class="{ active: assistantModel === model.name }">
                    {{ model.name }}
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
</template>
