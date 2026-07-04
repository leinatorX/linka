import { ref } from "vue";
import { getAvatarStyle, getProviderIconUrl } from "../utils/providerIcons";
import type { AiProviderConfig } from "../types";

export function useProviderIcons() {
  const failedProviderIconIds = ref<Set<string>>(new Set());

  function showProviderIcon(provider: Pick<AiProviderConfig, "id" | "name">): boolean {
    return !failedProviderIconIds.value.has(provider.id) && Boolean(getProviderIconUrl(provider));
  }

  function onProviderIconError(provider: Pick<AiProviderConfig, "id" | "name">) {
    failedProviderIconIds.value.add(provider.id);
  }

  return {
    getAvatarStyle,
    getProviderIconUrl,
    showProviderIcon,
    onProviderIconError
  };
}
