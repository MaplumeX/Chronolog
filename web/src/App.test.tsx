import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// i18n 由 setup.ts 全局初始化并固定为 en，无需额外 Provider。

function userBody(timezone: string | null) {
  return {
    id: "u1",
    username: "alice",
    displayName: null,
    timezone,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** useTheme 需要 window.matchMedia（jsdom 未提供）。 */
function stubMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      media: query,
      matches: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList),
  );
}

/** 渲染 App 并 mock 掉 me() 之后的常规请求（current/today/...）。 */
function stubFetch(
  meBody: unknown,
  meStatus = 200,
  profileBody?: unknown,
  profileStatus = 200,
) {
  const fn = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/api/auth/me")) {
      return Promise.resolve(jsonResponse(meBody, meStatus));
    }
    if (path.startsWith("/api/profile")) {
      return Promise.resolve(
        jsonResponse(profileBody ?? userBody("Asia/Shanghai"), profileStatus),
      );
    }
    if (path.startsWith("/api/categories")) return Promise.resolve(jsonResponse({ categories: [] }));
    if (path.startsWith("/api/tags")) return Promise.resolve(jsonResponse({ tags: [] }));
    if (path.startsWith("/api/entries/today"))
      return Promise.resolve(
        jsonResponse({
          tz: "UTC",
          dayStart: "2025-01-01T00:00:00.000Z",
          dayEnd: "2025-01-02T00:00:00.000Z",
          entries: [],
          totalClippedSeconds: 0,
        }),
      );
    if (path.startsWith("/api/entries/boundary"))
      return Promise.resolve(jsonResponse({ before: null, after: null }));
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function renderApp(meBody: unknown, meStatus = 200) {
  stubMatchMedia();
  const fn = stubFetch(meBody, meStatus);
  return { fn, ...render(<App />) };
}

afterEach(() => {
  cleanup();
});

describe("timezone 自动持久化", () => {
  it("user.timezone === null → fire-and-forget PATCH /api/profile 写入 browserTz()", async () => {
    const { fn } = renderApp(userBody(null));

    await waitFor(() => {
      const patch = fn.mock.calls.filter(([p]) => String(p) === "/api/profile");
      expect(patch.length).toBeGreaterThanOrEqual(1);
    });
    const patchCall = fn.mock.calls.find(([p]) => String(p) === "/api/profile");
    expect(patchCall).toBeDefined();
    const init = patchCall![1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it("成功后 setUser 更新（响应体成为后续 /api/current 的触发源，且不再重复 PATCH）", async () => {
    stubMatchMedia();
    const fn = stubFetch(userBody(null), 200, userBody("Asia/Shanghai"));
    render(<App />);

    // 持久化成功的响应把 user.timezone 更新为非 null，effect 不再触发
    await waitFor(() => {
      expect(
        fn.mock.calls.filter(([p]) => String(p).startsWith("/api/profile")).length,
      ).toBe(1);
    });
    // current 是按 user 身份 effect 触发的（null→Shanghai 两次都会拉取），
    // 但 profile PATCH 只应发生一次（按 id 去重 + timezone 非 null）
    const currentCalls = fn.mock.calls.filter(([p]) =>
      String(p).startsWith("/api/timer/current"),
    );
    expect(currentCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("user.timezone 非 null（用户手动设置过）→ 不触发 PATCH", async () => {
    const { fn } = renderApp(userBody("America/New_York"));

    await waitFor(() => {
      expect(
        fn.mock.calls.some(([p]) => String(p).startsWith("/api/timer/current")),
      ).toBe(true);
    });
    expect(fn.mock.calls.some(([p]) => String(p) === "/api/profile")).toBe(false);
  });

  it("PATCH 失败 → 静默不报错（App 不 crash，无额外重试风暴）", async () => {
    stubMatchMedia();
    const fn = stubFetch(
      userBody(null),
      200,
      { error: { code: "ERROR", message: "boom" } },
      500,
    );
    const { queryByText } = render(<App />);

    await waitFor(() => {
      expect(
        fn.mock.calls.some(([p]) => String(p) === "/api/profile"),
      ).toBe(true);
    });
    // 失败静默：页面仍在渲染（登录后的 shell），没有抛错文案
    expect(document.querySelector(".grid.min-h-dvh.text-muted-foreground")).toBeNull();
    expect(queryByText(/boom/i)).toBeNull();
  });

  it("me() 返回 401（未登录）→ 不触发 PATCH，渲染 AuthPage", async () => {
    const { fn, queryByRole } = renderApp(
      { error: { code: "UNAUTHORIZED", message: "unauth" } },
      401,
    );

    await waitFor(() => {
      expect(queryByRole("tab", { name: /log in/i })).toBeTruthy();
    });
    expect(fn.mock.calls.some(([p]) => String(p) === "/api/profile")).toBe(false);
  });
});
