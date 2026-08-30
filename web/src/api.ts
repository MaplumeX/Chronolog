import i18n from "./i18n";

export type User = { id: string; username: string; displayName: string | null };

export type Meta = { registrationOpen: boolean };

export type Category = {
  id: string;
  name: string;
  color: number | null;
  entryCount: number;
  parentId: string | null;
};

export type Tag = {
  id: string;
  name: string;
  color: number | null;
  entryCount: number;
  parentId: string | null;
};

export type ApiToken = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type GoalDirection = "lt" | "gt";
export type GoalPeriodUnit = "day" | "week" | "month";

/** goal 创建/更新请求体（镜像后端 zod createBody/updateBody 字段） */
export type GoalInput = {
  name: string;
  icon: string;
  categoryId: string | null;
  tagId: string | null;
  direction: GoalDirection;
  hours: number;
  periodUnit: GoalPeriodUnit;
  dueDate: string | null;
};

/** 镜像后端 GoalWithProgress（server/src/goals.ts）。
 * status 三态；lt 型超限由 direction + currentSeconds >= targetSeconds 前端判定。 */
export type Goal = GoalInput & {
  id: string;
  createdAt: string;
  status: "active" | "achieved" | "expired";
  progress: { currentSeconds: number | null; targetSeconds: number };
};

export type TimeEntry = {
  id: string;
  categoryId: string;
  categoryName: string;
  description: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number;
  clippedSeconds?: number;
  tags: { id: string; name: string }[];
};

export type TodayEntries = {
  tz: string;
  dayStart: string;
  dayEnd: string;
  entries: TimeEntry[];
  totalClippedSeconds: number;
};

export type WeekEntries = {
  tz: string;
  weekStart: string;
  weekEnd: string;
  days: TodayEntries[];
};

/** 查询窗口紧邻外侧条目（gap 插槽边界）：prev/next 各最多一条 */
export type BoundaryEntries = {
  tz: string;
  prevEntry: TimeEntry | null;
  nextEntry: TimeEntry | null;
};

export type TodayStats = {
  tz: string;
  dayStart: string;
  dayEnd: string;
  categories: { categoryId: string; categoryName: string; seconds: number }[];
  totalSeconds: number;
};

export type RangeStats = {
  tz: string;
  rangeStart: string;
  rangeEnd: string;
  days: { date: string; seconds: number }[];
  categories: { categoryId: string; categoryName: string; seconds: number }[];
  tags: { tagId: string | null; tagName: string | null; seconds: number }[];
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
    throw new ApiError(
      res.status,
      err?.code ?? "ERROR",
      err?.message ?? i18n.t("common.requestFailed"),
    );
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
  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  meta: () => request<Meta>("/api/meta"),
  updateProfile: (body: { username?: string; displayName?: string }) =>
    request<User>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>("/api/account/password", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAccount: (password: string) =>
    request<{ ok: boolean }>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),
  categories: () => request<{ categories: Category[] }>("/api/categories"),
  createCategory: (name: string, color?: number | null, parentId?: string | null) =>
    request<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name, color, parentId }),
    }),
  updateCategory: (
    id: string,
    body: { name?: string; color?: number | null; parentId?: string | null },
  ) =>
    request<{ id: string; name: string; color: number | null }>(
      `/api/categories/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    ),
  deleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/api/categories/${id}`, { method: "DELETE" }),
  tags: () => request<{ tags: Tag[] }>("/api/tags"),
  createTag: (name: string, color?: number | null, parentId?: string | null) =>
    request<Tag>("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name, color, parentId }),
    }),
  updateTag: (
    id: string,
    body: { name?: string; color?: number | null; parentId?: string | null },
  ) =>
    request<{ id: string; name: string; color: number | null }>(
      `/api/tags/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    ),
  deleteTag: (id: string) =>
    request<{ ok: boolean }>(`/api/tags/${id}`, { method: "DELETE" }),
  tokens: () => request<{ tokens: ApiToken[] }>("/api/tokens"),
  createToken: (name: string) =>
    request<{ id: string; name: string; token: string; createdAt: string }>(
      "/api/tokens",
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    ),
  deleteToken: (id: string) =>
    request<{ ok: boolean }>(`/api/tokens/${id}`, { method: "DELETE" }),
  current: () => request<{ entry: TimeEntry | null }>("/api/timer/current"),
  start: (categoryId: string, description?: string, tagIds?: string[]) =>
    request<{ entry: TimeEntry }>("/api/timer/start", {
      method: "POST",
      body: JSON.stringify({ categoryId, description, tagIds }),
    }),
  stop: () =>
    request<{ entry: TimeEntry }>("/api/timer/stop", { method: "POST" }),
  updateCurrent: (body: {
    description?: string;
    categoryId?: string;
    tagIds?: string[];
  }) =>
    request<{ entry: TimeEntry }>("/api/timer/current", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  todayEntries: (tz: string, date?: string) =>
    request<TodayEntries>(
      `/api/entries/today?tz=${encodeURIComponent(tz)}${date ? `&date=${encodeURIComponent(date)}` : ""}`,
    ),
  weekEntries: (tz: string, date?: string) =>
    request<WeekEntries>(
      `/api/entries/week?tz=${encodeURIComponent(tz)}${date ? `&date=${encodeURIComponent(date)}` : ""}`,
    ),
  boundaryEntries: (tz: string, start: string, end: string) =>
    request<BoundaryEntries>(
      `/api/entries/boundary?tz=${encodeURIComponent(tz)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    ),
  createEntry: (body: {
    description: string;
    categoryId: string;
    tagIds: string[];
    startedAt: string;
    stoppedAt: string;
  }) =>
    request<{ entry: TimeEntry }>("/api/entries", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateEntry: (
    id: string,
    body: {
      description: string;
      categoryId: string;
      tagIds: string[];
      startedAt: string;
      stoppedAt: string;
    },
  ) =>
    request<{ entry: TimeEntry }>(`/api/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  todayStats: (tz: string, tagId?: string, rollup?: boolean) =>
    request<TodayStats>(
      `/api/stats/today?tz=${encodeURIComponent(tz)}${tagId ? `&tagId=${encodeURIComponent(tagId)}` : ""}${rollup ? "&rollup=true" : ""}`,
    ),
  statsRange: (
    tz: string,
    from: string,
    to: string,
    tagId?: string,
    rollup?: boolean,
  ) =>
    request<RangeStats>(
      `/api/stats/range?tz=${encodeURIComponent(tz)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${tagId ? `&tagId=${encodeURIComponent(tagId)}` : ""}${rollup ? "&rollup=true" : ""}`,
    ),
  goals: (tz: string) =>
    request<{ goals: Goal[] }>(`/api/goals?tz=${encodeURIComponent(tz)}`),
  createGoal: (body: GoalInput) =>
    request<{ id: string }>("/api/goals", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateGoal: (id: string, body: Partial<GoalInput>) =>
    request<{ id: string }>(`/api/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteGoal: (id: string) =>
    request<{ ok: boolean }>(`/api/goals/${id}`, { method: "DELETE" }),
};
