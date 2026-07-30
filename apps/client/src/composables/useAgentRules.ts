import { ref, watch } from "vue";
import {
  createAgentRule,
  deleteAgentRule,
  getAgentRuleDetail,
  getAgentRules,
  updateAgentRule
} from "../api";
import type { AgentRule, AgentRulePayload } from "../types";

const rules = ref<AgentRule[]>([]);
const searchInput = ref("");
const selectedCategory = ref("all");
const selectedRuleType = ref("all");
const loading = ref(false);
const errorMsg = ref("");

let searchDebounceTimer: number;

export function useAgentRules() {
  async function loadRules() {
    loading.value = true;
    errorMsg.value = "";
    try {
      const res = await getAgentRules(
        searchInput.value,
        selectedCategory.value,
        selectedRuleType.value
      );
      rules.value = res.rules;
    } catch (e: any) {
      errorMsg.value = e.message || "获取 Agent 规则失败";
    } finally {
      loading.value = false;
    }
  }

  watch([selectedCategory, selectedRuleType], () => {
    loadRules();
  });

  watch(searchInput, () => {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      loadRules();
    }, 300);
  });

  async function fetchDetail(id: string) {
    const res = await getAgentRuleDetail(id);
    return res.rule;
  }

  async function saveRule(payload: AgentRulePayload, id?: string) {
    loading.value = true;
    errorMsg.value = "";
    try {
      if (id) {
        await updateAgentRule(id, payload);
      } else {
        await createAgentRule(payload);
      }
      await loadRules();
    } catch (e: any) {
      errorMsg.value = e.message || "保存规则失败";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function removeRule(id: string) {
    loading.value = true;
    errorMsg.value = "";
    try {
      await deleteAgentRule(id);
      await loadRules();
    } catch (e: any) {
      errorMsg.value = e.message || "删除规则失败";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    rules,
    searchInput,
    selectedCategory,
    selectedRuleType,
    loading,
    errorMsg,
    loadRules,
    fetchDetail,
    saveRule,
    removeRule
  };
}
