import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { zh } from "./locales/zh";

export const LANG_STORAGE_KEY = "chronolog.lang";

export const LANGS = ["zh", "en"] as const;
export type Lang = (typeof LANGS)[number];

export function localeFor(lng: string): string {
  return lng === "zh" ? "zh-CN" : lng;
}

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return LANGS.includes(stored as Lang) ? (stored as Lang) : "zh";
  } catch {
    return "zh"; // storage unavailable (private mode / disabled) → default
  }
}

function writeStoredLang(lng: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    // storage unavailable → language still applies for this session
  }
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: readStoredLang(),
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

// init() resolves the language synchronously (resources are bundled), but its
// languageChanged event fires before the listener below is attached, so sync
// the initial <html lang> here.
document.documentElement.lang = localeFor(i18n.language);

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = localeFor(lng);
});

export function changeLanguage(lng: Lang) {
  writeStoredLang(lng);
  void i18n.changeLanguage(lng);
}

export default i18n;
