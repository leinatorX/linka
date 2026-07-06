import { ref } from "vue";
import { getAuthStatus, loginUser, logoutUser, updateAuthAvatar, updateAuthProfile } from "../api";
import type { AuthUser } from "../types";

const REMEMBER_USERNAME_KEY = "linka.rememberUsername";
const SAVED_USERNAME_KEY = "linka.savedUsername";
const AUTO_LOGIN_KEY = "linka.autoLogin";

export function useAuth() {
  const authLoading = ref(true);
  const authUser = ref<AuthUser | null>(null);
  const loginUsername = ref(localStorage.getItem(SAVED_USERNAME_KEY) ?? "");
  const loginPassword = ref("");
  const rememberUsername = ref(localStorage.getItem(REMEMBER_USERNAME_KEY) !== "false");
  const autoLogin = ref(localStorage.getItem(AUTO_LOGIN_KEY) !== "false");
  const loginMessage = ref("");
  const isLoginSaving = ref(false);
  const accountUsername = ref("");
  const accountAvatarUrl = ref("");
  const accountCurrentPassword = ref("");
  const accountNewPassword = ref("");
  const accountConfirmPassword = ref("");
  const accountMessage = ref("");
  const avatarMessage = ref("");
  const isAvatarSaving = ref(false);
  const isAccountSaving = ref(false);

  function syncAccountForm(user: AuthUser | null) {
    accountUsername.value = user?.username ?? "";
    accountAvatarUrl.value = user?.avatarUrl ?? "";
    accountCurrentPassword.value = "";
    accountNewPassword.value = "";
    accountConfirmPassword.value = "";
  }

  async function loadCurrentUser() {
    authLoading.value = true;
    try {
      const result = await getAuthStatus();
      authUser.value = result.user;
      syncAccountForm(result.user);
    } catch {
      authUser.value = null;
      syncAccountForm(null);
    } finally {
      authLoading.value = false;
    }
  }

  async function signIn() {
    const username = loginUsername.value.trim();
    if (!username || !loginPassword.value) {
      loginMessage.value = "请输入用户名和密码。";
      return null;
    }

    isLoginSaving.value = true;
    loginMessage.value = "";
    try {
      const result = await loginUser({
        username,
        password: loginPassword.value,
        rememberSession: autoLogin.value
      });
      authUser.value = result.user;
      loginPassword.value = "";
      localStorage.setItem(REMEMBER_USERNAME_KEY, rememberUsername.value ? "true" : "false");
      localStorage.setItem(AUTO_LOGIN_KEY, autoLogin.value ? "true" : "false");
      if (rememberUsername.value) {
        localStorage.setItem(SAVED_USERNAME_KEY, username);
      } else {
        localStorage.removeItem(SAVED_USERNAME_KEY);
      }
      syncAccountForm(result.user);
      return result.user;
    } catch (error) {
      loginMessage.value = error instanceof Error ? error.message : "登录失败。";
      return null;
    } finally {
      isLoginSaving.value = false;
    }
  }

  async function signOut() {
    await logoutUser().catch(() => undefined);
    authUser.value = null;
    syncAccountForm(null);
  }

  async function saveAccount() {
    const username = accountUsername.value.trim();
    const newPassword = accountNewPassword.value.trim();
    if (!username) {
      accountMessage.value = "请输入用户名。";
      return false;
    }
    if (!accountCurrentPassword.value) {
      accountMessage.value = "请输入当前密码。";
      return false;
    }
    if (newPassword && newPassword !== accountConfirmPassword.value.trim()) {
      accountMessage.value = "两次输入的新密码不一致。";
      return false;
    }

    isAccountSaving.value = true;
    accountMessage.value = "";
    try {
      const result = await updateAuthProfile({
        username,
        currentPassword: accountCurrentPassword.value,
        newPassword: newPassword || undefined
      });
      authUser.value = result.user;
      syncAccountForm(result.user);
      accountMessage.value = "账号信息已更新。";
      return true;
    } catch (error) {
      accountMessage.value = error instanceof Error ? error.message : "保存失败。";
      return false;
    } finally {
      isAccountSaving.value = false;
    }
  }

  async function saveAvatar(avatarUrl: string) {
    isAvatarSaving.value = true;
    avatarMessage.value = "";
    try {
      const result = await updateAuthAvatar(avatarUrl);
      authUser.value = result.user;
      accountAvatarUrl.value = result.user.avatarUrl;
      avatarMessage.value = avatarUrl ? "头像已更新。" : "头像已清除。";
      return true;
    } catch (error) {
      avatarMessage.value = error instanceof Error ? error.message : "头像保存失败。";
      return false;
    } finally {
      isAvatarSaving.value = false;
    }
  }

  return {
    authLoading,
    authUser,
    loginUsername,
    loginPassword,
    rememberUsername,
    autoLogin,
    loginMessage,
    isLoginSaving,
    accountUsername,
    accountAvatarUrl,
    accountCurrentPassword,
    accountNewPassword,
    accountConfirmPassword,
    accountMessage,
    avatarMessage,
    isAvatarSaving,
    isAccountSaving,
    loadCurrentUser,
    signIn,
    signOut,
    saveAvatar,
    saveAccount
  };
}
