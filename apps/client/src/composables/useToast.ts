import { ref } from "vue";

export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export function useToast() {
  const toasts = ref<Toast[]>([]);
  let nextToastId = 0;

  function showToast(message: string, type: ToastType = "info", duration = 3000) {
    const id = nextToastId++;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter((toast) => toast.id !== id);
    }, duration);
  }

  return {
    toasts,
    showToast
  };
}
