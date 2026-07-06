import { ref, onMounted } from "vue";

export type ThemeMode = "light" | "dark";

export function useTheme() {
  const theme = ref<ThemeMode>("dark");

  const applyTheme = (nextTheme: ThemeMode) => {
    theme.value = nextTheme;
    localStorage.setItem("linka-theme", nextTheme);

    const root = document.documentElement;
    root.classList.toggle("light-theme", nextTheme === "light");
    root.classList.toggle("dark-theme", nextTheme === "dark");
    root.setAttribute("data-theme", nextTheme);
  };

  const initTheme = () => {
    const saved = localStorage.getItem("linka-theme");
    applyTheme(saved === "light" || saved === "dark" ? saved : "dark");
  };

  onMounted(() => {
    initTheme();
  });

  return {
    theme,
    applyTheme
  };
}
