import { ref, watch } from "vue";
import {
  createVaultItem,
  deleteVaultItem,
  getVaultItemDetail,
  getVaultStatus,
  listVaultItems,
  lockVault,
  resetVault,
  setupVault,
  unlockVault,
  updateVaultItem
} from "../api";
import type { VaultItemDetail, VaultItemSummary } from "../types";

const isInitialized = ref(false);
const isUnlocked = ref(false);
const vaultToken = ref(sessionStorage.getItem("linka_vault_token") || "");
const items = ref<VaultItemSummary[]>([]);
const searchInput = ref("");
const selectedCategory = ref("all");
const loading = ref(false);
const errorMsg = ref("");

export function useVault() {
  async function checkStatus() {
    try {
      const res = await getVaultStatus(vaultToken.value);
      isInitialized.value = res.isInitialized;
      isUnlocked.value = res.isUnlocked;
      if (!res.isUnlocked) {
        vaultToken.value = "";
        sessionStorage.removeItem("linka_vault_token");
        items.value = [];
      } else {
        await loadItems();
      }
    } catch (e: any) {
      errorMsg.value = e.message || "获取保险箱状态失败";
    }
  }

  async function initialize(masterPassword: string) {
    loading.value = true;
    errorMsg.value = "";
    try {
      const res = await setupVault(masterPassword);
      vaultToken.value = res.vaultToken;
      sessionStorage.setItem("linka_vault_token", res.vaultToken);
      isInitialized.value = true;
      isUnlocked.value = true;
      await loadItems();
    } catch (e: any) {
      errorMsg.value = e.message || "初始化失败";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function unlock(masterPassword: string) {
    loading.value = true;
    errorMsg.value = "";
    try {
      const res = await unlockVault(masterPassword);
      vaultToken.value = res.vaultToken;
      sessionStorage.setItem("linka_vault_token", res.vaultToken);
      isUnlocked.value = true;
      await loadItems();
    } catch (e: any) {
      errorMsg.value = e.message || "解锁失败";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function lock() {
    if (vaultToken.value) {
      await lockVault(vaultToken.value).catch(() => {});
    }
    vaultToken.value = "";
    sessionStorage.removeItem("linka_vault_token");
    isUnlocked.value = false;
    items.value = [];
  }

  async function reset(password: string) {
    loading.value = true;
    errorMsg.value = "";
    try {
      await resetVault(password);
      vaultToken.value = "";
      sessionStorage.removeItem("linka_vault_token");
      isInitialized.value = false;
      isUnlocked.value = false;
      items.value = [];
    } catch (e: any) {
      errorMsg.value = e.message || "重置失败";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function loadItems() {
    if (!vaultToken.value || !isUnlocked.value) return;
    loading.value = true;
    try {
      const res = await listVaultItems(
        vaultToken.value,
        searchInput.value,
        selectedCategory.value
      );
      items.value = res.items;
    } catch (e: any) {
      if (e.message?.includes("锁定") || e.message?.includes("解锁")) {
        lock();
      } else {
        errorMsg.value = e.message || "加载列表失败";
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchDetail(id: string): Promise<VaultItemDetail> {
    if (!vaultToken.value || !isUnlocked.value) {
      lock();
      throw new Error("保险箱已锁定，请先解锁");
    }
    try {
      const res = await getVaultItemDetail(vaultToken.value, id);
      return res.item;
    } catch (e: any) {
      if (e.message?.includes("锁定") || e.message?.includes("解锁")) {
        lock();
      }
      throw e;
    }
  }

  async function saveItem(payload: any, id?: string) {
    if (!vaultToken.value || !isUnlocked.value) {
      lock();
      throw new Error("保险箱已锁定，请先解锁");
    }
    loading.value = true;
    try {
      if (id) {
        await updateVaultItem(vaultToken.value, id, payload);
      } else {
        await createVaultItem(vaultToken.value, payload);
      }
      await loadItems();
    } catch (e: any) {
      if (e.message?.includes("锁定") || e.message?.includes("解锁")) {
        lock();
      } else {
        errorMsg.value = e.message || "保存失败";
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function removeItem(id: string) {
    if (!vaultToken.value || !isUnlocked.value) {
      lock();
      return;
    }
    loading.value = true;
    try {
      await deleteVaultItem(vaultToken.value, id);
      await loadItems();
    } catch (e: any) {
      if (e.message?.includes("锁定") || e.message?.includes("解锁")) {
        lock();
      } else {
        errorMsg.value = e.message || "删除失败";
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  watch([searchInput, selectedCategory], () => {
    if (isUnlocked.value) {
      loadItems();
    }
  });

  return {
    isInitialized,
    isUnlocked,
    vaultToken,
    items,
    searchInput,
    selectedCategory,
    loading,
    errorMsg,
    checkStatus,
    initialize,
    unlock,
    lock,
    reset,
    loadItems,
    fetchDetail,
    saveItem,
    removeItem
  };
}
