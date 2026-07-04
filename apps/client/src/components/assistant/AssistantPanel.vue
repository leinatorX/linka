<script setup lang="ts">
import { Bot, ChevronDown, History, Loader2, Mic, Plus, Search, Send, X } from "@lucide/vue";
import type { AssistantUiMessage } from "../../composables/useAssistant";
import type { AiModelConfig, AssistantConversation } from "../../types";

defineProps<{
  isSettingsPage: boolean;
  activeConversation?: AssistantConversation;
  filteredConversations: AssistantConversation[];
  activeConversationId: string | null;
  selectedConversationIds: Set<string>;
  assistantMessages: AssistantUiMessage[];
  isAssistantLoading: boolean;
  assistantEffortOptions: string[];
  availableModels: AiModelConfig[];
}>();

const assistantOpen = defineModel<boolean>("assistantOpen", { required: true });
const assistantHistoryOpen = defineModel<boolean>("assistantHistoryOpen", { required: true });
const assistantHistoryManage = defineModel<boolean>("assistantHistoryManage", { required: true });
const historySearchInput = defineModel<string>("historySearchInput", { required: true });
const assistantInput = defineModel<string>("assistantInput", { required: true });
const assistantModel = defineModel<string>("assistantModel", { required: true });
const assistantEffort = defineModel<string>("assistantEffort", { required: true });
const modelSelectOpen = defineModel<boolean>("modelSelectOpen", { required: true });
const effortSelectOpen = defineModel<boolean>("effortSelectOpen", { required: true });

defineEmits<{
  askAssistant: [];
  toggleAssistantHistory: [];
  startNewAssistantConversation: [];
  toggleConversationSelected: [conversationId: string];
  openAssistantConversation: [conversationId: string];
  removeSelectedConversations: [];
  toggleModelSelect: [event: Event];
  toggleEffortSelect: [event: Event];
}>();
</script>

<template>
  <button class="assistant-fab" title="唤起 AI 助手" @click="assistantOpen = true"
    v-show="!assistantOpen && !isSettingsPage">
    <Bot />
  </button>

  <transition name="fade">
    <aside v-if="assistantOpen && !isSettingsPage" class="assistant-panel">
      <div class="assistant-header">
        <div class="brand-icon assistant-brand-icon">
          <Bot :size="20" />
        </div>
        <div class="assistant-header-text">
          <h2>AI 助手</h2>
          <p>{{ activeConversation?.title || '随时为你整理和检索' }}</p>
        </div>
        <button class="tool-btn" title="历史记录" :class="{ active: assistantHistoryOpen }"
          @click="$emit('toggleAssistantHistory')">
          <History :size="18" />
        </button>
        <button class="tool-btn" title="新建对话" @click="$emit('startNewAssistantConversation')">
          <Plus :size="18" />
        </button>
        <button class="btn-close" title="关闭" @click="assistantOpen = false">
          <X :size="20" />
        </button>
      </div>

      <div v-if="assistantHistoryOpen" class="assistant-history-page">
        <div class="history-search">
          <Search :size="16" />
          <input v-model="historySearchInput" placeholder="搜索历史记录..." />
        </div>
        <div class="history-actions">
          <span>历史记录</span>
          <button class="mini-button" @click="assistantHistoryManage = !assistantHistoryManage">
            {{ assistantHistoryManage ? '完成' : '管理' }}
          </button>
        </div>
        <div class="history-list">
          <button v-for="conversation in filteredConversations" :key="conversation.id" class="history-item"
            :class="{ active: activeConversationId === conversation.id }"
            @click="assistantHistoryManage ? $emit('toggleConversationSelected', conversation.id) : $emit('openAssistantConversation', conversation.id)">
            <input v-if="assistantHistoryManage" type="checkbox"
              :checked="selectedConversationIds.has(conversation.id)"
              @click.stop="$emit('toggleConversationSelected', conversation.id)" />
            <div>
              <strong>{{ conversation.title }}</strong>
              <span>{{ new Date(conversation.updatedAt).toLocaleString() }}</span>
            </div>
          </button>
          <div v-if="filteredConversations.length === 0" class="history-empty">
            暂无历史记录
          </div>
        </div>
        <div class="history-manage-bar" v-if="assistantHistoryManage">
          <span>已选择 {{ selectedConversationIds.size }} 条</span>
          <button class="mini-button danger" :disabled="selectedConversationIds.size === 0"
            @click="$emit('removeSelectedConversations')">
            批量删除
          </button>
        </div>
      </div>

      <div v-else class="message-list">
        <div v-for="(message, index) in assistantMessages" :key="index" class="message" :class="message.role">
          <div v-if="message.reasoning" class="message-reasoning" :class="{ collapsed: message.reasoningCollapsed }">
            <button class="message-reasoning-toggle" type="button"
              @click="message.reasoningCollapsed = !message.reasoningCollapsed">
              <span>{{ message.streaming ? '思考中' : '思考完成' }}</span>
              <ChevronDown :size="14" />
            </button>
            <p v-if="!message.reasoningCollapsed">{{ message.reasoning }}<span
                v-if="message.streaming && !message.text" class="stream-cursor"></span></p>
          </div>
          <p v-if="message.text || !message.reasoning">{{ message.text }}<span v-if="message.streaming"
              class="stream-cursor"></span></p>
          <div v-if="message.results?.length" class="result-list">
            <a v-for="result in message.results" :key="result.id" :href="result.url" target="_blank" rel="noreferrer">
              {{ result.title }}
              <span>{{ result.category }}</span>
            </a>
          </div>
        </div>
      </div>

      <div class="assistant-input-wrapper" v-if="!assistantHistoryOpen">
        <textarea v-model="assistantInput" placeholder="向 AI 提问，或输入 / 触发技能，@ 引用上下文"
          @keydown.enter.exact.prevent="$emit('askAssistant')"></textarea>
        <div class="input-toolbar">
          <div class="toolbar-left">
            <button class="tool-btn" title="上传附件">
              <Plus :size="18" />
            </button>
            <div class="custom-select" :class="{ open: modelSelectOpen }">
              <div class="select-trigger" @click="$emit('toggleModelSelect', $event)">
                <span>{{ assistantModel || '默认模型' }}</span>
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
                    @click="assistantModel = '默认模型'; modelSelectOpen = false">
                    默认模型
                  </div>
                </div>
              </transition>
            </div>

            <div class="custom-select" :class="{ open: effortSelectOpen }">
              <div class="select-trigger" @click="$emit('toggleEffortSelect', $event)">
                <span>{{ assistantEffort }}</span>
                <ChevronDown :size="14" class="select-icon" />
              </div>
              <transition name="fade">
                <div class="select-dropdown" v-if="effortSelectOpen" @click.stop>
                  <div class="select-option" v-for="effort in assistantEffortOptions" :key="effort"
                    @click="assistantEffort = effort; effortSelectOpen = false"
                    :class="{ active: assistantEffort === effort }">
                    {{ effort }}
                  </div>
                </div>
              </transition>
            </div>
          </div>
          <div class="toolbar-right">
            <button class="tool-btn" title="语音输入">
              <Mic :size="18" />
            </button>
            <button class="btn-send" title="发送 (Enter)" :disabled="isAssistantLoading" @click="$emit('askAssistant')">
              <Loader2 v-if="isAssistantLoading" class="spin" :size="16" />
              <Send v-else :size="16" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  </transition>
</template>
