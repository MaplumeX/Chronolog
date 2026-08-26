import i18n from "./i18n";

export type User = { id: string; username: string };

export type Category = { id: string; name: string; entryCount: number };

export type TimeEntry = {
  id: string;
  categoryId: string;
  categoryName: string;
  description: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number;
  clippedSeconds?: number;
};

export type TodayEntries = {
  tz: string;
  dayStart: string;
  dayEnd: string;
  entries: TimeEntry[];
  totalClippedSeconds: number;
};

export type TodayStats = {
  tz: string;
  dayStart: string;
  dayEnd: string;
  categories: { categoryId: string; categoryName: string; seconds: number }[];
  totalSeconds: number;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let onUnauthorized: (() => void) | undefined;

export function setOnUnauthorized(fn: (() => void) | undefined) {
  onUnauthorized = fn;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: { authFail?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "NETWORK", i18n.t("errors.network"));
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const err = data.error as { code?: string; message?: string } | undefined;
    if (res.status === 401 && opts.authFail !== false) onUnauthorized?.();
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? i18n.t("common.requestFailed"));
  }
  return data as T;
}

export const api = {
  me: () => request<User>("/api/auth/me", {}, { authFail: false }),
  register: (username: string, password: string) =>
    request<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    request<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  categories: () => request<{ categories: Category[] }>("/api/categories"),
  createCategory: (name: string) =>
    request<Category>("/api/categories", { method: "POST", body: JSON.stringify({ name }) }),
  renameCategory: (id: string, name: string) =>
    request<{ id: string; name: string }>(`/api/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/api/categories/${id}`, { method: "DELETE" }),
  current: () => request<{ entry: TimeEntry | null }>("/api/timer/current"),
  start: (categoryId: string, description?: string) =>
    request<{ entry: TimeEntry }>("/api/timer/start", {
      method: "POST",
      body: JSON.stringify({ categoryId, description }),
    }),
  stop: () => request<{ entry: TimeEntry }>("/api/timer/stop", { method: "POST" }),
  todayEntries: (tz: string) =>
    request<TodayEntries>(`/api/entries/today?tz=${encodeURIComponent(tz)}`),
  todayStats: (tz: string) =>
    request<TodayStats>(`/api/stats/today?tz=${encodeURIComponent(tz)}`),
};
