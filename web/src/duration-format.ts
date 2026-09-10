import { useSyncExternalStore } from "react";

/**
 * 时长显示格式偏好（localStorage 持久化，同主题/语言的 chronolog-* 键约定）：
 * - letters：`1h 30m 5s`（默认）
 * - chinese：`1小时30分5秒`
 *
 * 单例 + 订阅模型（同 i18n 单例思路）：纯函数 formatDuration 直接读 getDurationFormat()，
 * App 顶层 useDurationFormat() 订阅变更触发全树重渲染（无 memo 屏障）。
 */
export type DurationFormat = "letters" | "chinese";

export const DURATION_FORMATS: readonly DurationFormat[] = ["letters", "chinese"];

export const DURATION_FORMAT_STORAGE_KEY = "chronolog-duration-format";

/** localStorage 读取时长格式偏好；隐私模式 / 垃圾值静默降级为 letters（默认）。 */
function readStoredFormat(): DurationFormat {
  try {
    const v = window.localStorage.getItem(DURATION_FORMAT_STORAGE_KEY);
    return DURATION_FORMATS.includes(v as DurationFormat) ? (v as DurationFormat) : "letters";
  } catch {
    return "letters";
  }
}

let current: DurationFormat = readStoredFormat();

export function getDurationFormat(): DurationFormat {
  return current;
}

const listeners = new Set<() => void>();

export function setDurationFormat(next: DurationFormat): void {
  try {
    window.localStorage.setItem(DURATION_FORMAT_STORAGE_KEY, next);
  } catch {
    // localStorage 不可用（隐私模式）：仅内存态生效
  }
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 订阅当前时长格式；App 顶层调用一次，切换设置时全树重渲染。 */
export function useDurationFormat(): DurationFormat {
  return useSyncExternalStore(subscribe, getDurationFormat);
}
