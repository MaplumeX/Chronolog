import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, setOnUnauthorized } from "./api";

function fetchMock(impl?: (path: string, init: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(
    impl ??
      (() => new Response(JSON.stringify({}), { status: 200 })),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  // 避免用例间泄漏 401 回调（setup 的 unstubAllGlobals 不会复位它）。
  setOnUnauthorized(undefined);
});

describe("request 成功路径", () => {
  it("返回解析后的 JSON", async () => {
    fetchMock(() => jsonResponse({ registrationOpen: true }));
    await expect(api.meta()).resolves.toEqual({ registrationOpen: true });
  });

  it("空 body 响应 → {}", async () => {
    fetchMock(() => new Response(null, { status: 200 }));
    await expect(api.meta()).resolves.toEqual({});
  });

  it("请求带 credentials: same-origin", async () => {
    const fn = fetchMock(() => jsonResponse({ registrationOpen: false }));
    await api.meta();
    const init = fn.mock.calls[0]![1] as RequestInit;
    expect(init.credentials).toBe("same-origin");
  });
});

describe("request HTTP 错误", () => {
  it("{ error: { code, message } } → ApiError 透传 status/code/message", async () => {
    fetchMock(() => jsonResponse({ error: { code: "NOT_FOUND", message: "未找到" } }, 404));
    const err = await api.meta().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.name).toBe("ApiError");
    expect(apiErr.status).toBe(404);
    expect(apiErr.code).toBe("NOT_FOUND");
    expect(apiErr.message).toBe("未找到");
  });

  it("body 无 error 字段 → code 回退 'ERROR'，message 回退 i18n 文案", async () => {
    fetchMock(() => jsonResponse({ something: "else" }, 500));
    const err = (await api.meta().catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.code).toBe("ERROR");
    expect(err.message).toBe("Request failed"); // en: common.requestFailed
  });

  it("非 JSON 空 body 错误 → 同样回退", async () => {
    fetchMock(() => new Response(null, { status: 502 }));
    const err = (await api.meta().catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(502);
    expect(err.code).toBe("ERROR");
    expect(err.message).toBe("Request failed");
  });
});

describe("request 网络错误", () => {
  it("fetch reject → ApiError(0, 'NETWORK', i18n errors.network)", async () => {
    fetchMock(() => Promise.reject(new TypeError("fetch failed")));
    const err = (await api.meta().catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe("NETWORK");
    expect(err.message).toBe("Cannot connect to the server"); // en: errors.network
  });
});

describe("401 与 onUnauthorized", () => {
  it("非 me 请求返回 401 → 触发 onUnauthorized，且仍抛 ApiError", async () => {
    fetchMock(() => jsonResponse({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401));
    const spy = vi.fn();
    setOnUnauthorized(spy);
    const err = (await api.meta().catch((e: unknown) => e)) as ApiError;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("api.me()（authFail:false）返回 401 → 不触发 onUnauthorized", async () => {
    fetchMock(() => jsonResponse({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401));
    const spy = vi.fn();
    setOnUnauthorized(spy);
    const err = (await api.me().catch((e: unknown) => e)) as ApiError;
    expect(spy).not.toHaveBeenCalled();
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("未注册 onUnauthorized 时 401 不抛额外错误", async () => {
    fetchMock(() => jsonResponse({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401));
    const err = (await api.logout().catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(401);
  });
});

describe("Content-Type 注入", () => {
  it("有 body 时自动加 application/json", async () => {
    const fn = fetchMock(() => jsonResponse({ id: "u1" }));
    await api.login("alice", "password123");
    const init = fn.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("无 body 的请求不注入 Content-Type", async () => {
    const fn = fetchMock(() => jsonResponse({ registrationOpen: true }));
    await api.meta();
    const init = fn.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Headers).has("Content-Type")).toBe(false);
  });
});

describe("查询参数编码", () => {
  it("todayEntries 编码 tz 与可选 date", async () => {
    const fn = fetchMock(() => jsonResponse({ entries: [] }));
    await api.todayEntries("Asia/Shanghai", "2025-11-20");
    const url = fn.mock.calls[0]![0] as string;
    expect(url).toBe("/api/entries/today?tz=Asia%2FShanghai&date=2025-11-20");
  });

  it("todayEntries 省略 date 时无 date 参数", async () => {
    const fn = fetchMock(() => jsonResponse({ entries: [] }));
    await api.todayEntries("UTC");
    const url = fn.mock.calls[0]![0] as string;
    expect(url).toBe("/api/entries/today?tz=UTC");
  });

  it("statsRange 带 tagId 与 rollup", async () => {
    const fn = fetchMock(() => jsonResponse({ days: [] }));
    await api.statsRange("UTC", "2025-11-01", "2025-11-20", "tag-1", true);
    const url = fn.mock.calls[0]![0] as string;
    expect(url).toBe(
      "/api/stats/range?tz=UTC&from=2025-11-01&to=2025-11-20&tagId=tag-1&rollup=true",
    );
  });

  it("todayStats 省略 tagId/rollup 时参数干净", async () => {
    const fn = fetchMock(() => jsonResponse({ categories: [] }));
    await api.todayStats("UTC");
    const url = fn.mock.calls[0]![0] as string;
    expect(url).toBe("/api/stats/today?tz=UTC");
  });
});
