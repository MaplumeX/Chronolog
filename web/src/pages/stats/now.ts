import { useEffect, useState } from "react";

/**
 * 秒级时钟（Date.now()）。历史日期固定取加载时刻；今天则每秒刷新，
 * 驱动运行中条目的弧段右端与中心覆盖度实时生长（数据本身由容器 5s 轮询刷新）。
 */
export function useNowMs(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return nowMs;
}
