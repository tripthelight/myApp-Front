const THEME_STORAGE_KEY = "rhythm-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function initializeTheme() {
  applyTheme(resolveInitialTheme());
}

export function getTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
  applyTheme(normalizedTheme);
  window.dispatchEvent(new CustomEvent("rhythm-theme-change", { detail: { theme: normalizedTheme } }));
}

function resolveInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", theme === "dark" ? "#242033" : "#8d72d8");
  }
}
