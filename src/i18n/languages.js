export const LANGUAGE_OPTIONS = Object.freeze([
  { value: "system", label: "System Language" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "ru", label: "Русский" },
  { value: "ja", label: "日本語" },
  { value: "id", label: "Indonesia" },
  { value: "zh", label: "中文" },
  { value: "ko", label: "한국어" },
]);

export function resolveBrowserLanguage() {
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || "en"];

  for (const candidate of candidates) {
    const code = String(candidate).toLowerCase().split("-")[0];
    if (["en", "pt", "de", "it", "es", "fr", "ru", "ja", "id", "zh", "ko"].includes(code)) return code;
  }
  return "en";
}
