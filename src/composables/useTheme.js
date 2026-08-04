import { ref, watchEffect } from "vue";

const THEME_STORAGE_KEY = "general-calendar.theme.v1";

function loadTheme() {
  const stored = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);

  return stored === "dark" || stored === "light" ? stored : "light";
}

const theme = ref(loadTheme());

watchEffect(() => {
  if (theme.value === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
});

function persistTheme() {
  globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme.value);
}

function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
  persistTheme();
}

function setTheme(value) {
  if (value === "dark" || value === "light") {
    theme.value = value;
    persistTheme();
  }
}

export function useTheme() {
  return { theme, toggleTheme, setTheme };
}
