import type { TimeEntry } from "./api";

/** 空档：全局绝对时刻（可跨天/跨多天）；点击后以其起止创建条目 */
export type Gap = { startMs: number; endMs: number };

/**
 * 计算视图窗口内全部条目（含 boundary 外邻）之间的空档（design §4）：
 * 把窗口内条目（运行中按 nowMs 为右端）与 prevEntry/nextEntry 合并为覆盖区间序列，
 * gap = 相邻区间之间的空隙，输出全局绝对时刻（可跨天/跨多天）。各列渲染时与自身窗口求交：
 * - 列内相邻条目、跨午夜条目前后、空列（多天空档中间投影，需双侧 boundary 都存在）自然正确；
 * - prevEntry 缺失则首条前无 gap，nextEntry 缺失则末条后无 gap（R1/R3，
 *   同样适用于空列：单侧缺失不渲染，无另一侧边界不算「两个已有条目之间」）。
 */
export function computeGaps(
  viewWindow: { startMs: number; endMs: number },
  entries: TimeEntry[],
  boundary: { prevEntry: TimeEntry | null; nextEntry: TimeEntry | null } | null,
  nowMs: number,
): Gap[] {
  const { startMs: wStart, endMs: wEnd } = viewWindow;
  if (wEnd <= wStart) return [];

  // 覆盖区间：运行中条目右端 = nowMs（同用户唯一 running，无后继）
  const rightEdge = (e: TimeEntry) =>
    e.stoppedAt ? Date.parse(e.stoppedAt) : nowMs;
  // 去重：周视图同一条目会出现在多个 day bucket（跨午夜）
  const byId = new Map<string, { start: number; end: number }>();
  for (const e of entries) {
    byId.set(e.id, { start: Date.parse(e.startedAt), end: rightEdge(e) });
  }
  const intervals = [...byId.values()].sort((a, b) => a.start - b.start);

  const gaps: Gap[] = [];
  const push = (startMs: number, endMs: number) => {
    if (endMs - startMs <= 0) return;
    // 只保留与视图窗口有交集的 gap（外邻之前的空隙不关心）
    if (endMs <= wStart || startMs >= wEnd) return;
    gaps.push({ startMs, endMs });
  };

  const prev = boundary?.prevEntry ?? null;
  const next = boundary?.nextEntry ?? null;

  // 前邻是运行中条目（右端 = nowMs 仍在推进，覆盖窗口起点）：窗口起点侧无空档
  if (prev && !prev.stoppedAt) return gaps;

  if (intervals.length === 0) {
    // 空窗口：仅两侧**都**存在边界条目时渲染（= 跨多天空档的中间投影）。
    // 单侧存在（未来无条目日 / 有史以来最早条目之前的日期）或双侧缺失
    // （新用户零条目 / boundary 请求失败降级）都不渲染——「两个已有条目」
    // 之间才算 gap（R1/R3），单侧没有另一侧边界（design §4 规则 4、§6）
    if (!prev || !next) return gaps;
    push(rightEdge(prev), Date.parse(next.startedAt));
    return gaps;
  }

  // 顶部：prevEntry 右端 → 首条（prevEntry 跨午夜伸入窗口时它也在 entries 里，
  // 排序后首条即它，gap 非正被跳过，公式自动正确）
  if (prev) push(rightEdge(prev), intervals[0].start);
  // 相邻区间之间（含跨列、跨午夜条目两侧）
  for (let i = 0; i + 1 < intervals.length; i++) {
    push(intervals[i].end, intervals[i + 1].start);
  }
  // 底部：末条右端 → nextEntry.startedAt
  if (next) push(intervals[intervals.length - 1].end, Date.parse(next.startedAt));
  return gaps;
}
