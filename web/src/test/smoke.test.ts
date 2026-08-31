import { describe, expect, it } from "vitest";
import i18n from "@/i18n";

describe("test infrastructure smoke", () => {
  it("runs in a jsdom environment", () => {
    expect(document).toBeDefined();
    expect(document.documentElement).toBeInstanceOf(HTMLElement);
  });

  it("pins i18n language to en", () => {
    expect(i18n.language).toBe("en");
  });

  it("registers jest-dom matchers", () => {
    const el = document.createElement("div");
    el.textContent = "hello";
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("hello");
    el.remove();
  });
});
