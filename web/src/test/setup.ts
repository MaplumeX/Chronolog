import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import i18n from "@/i18n";

// Pin the UI language so assertions on translated copy are deterministic.
void i18n.changeLanguage("en");

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
