import { useTranslation } from "react-i18next";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { formatDuration } from "../../format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UNLOGGED_COLOR } from "./DayRingChart";
import { NULL_CATEGORY_KEY, type DailyByCategory } from "./stats-utils";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: "0.75rem",
};

export type StackedCompositionChartProps = {
  /** 模块卡标题 */
  title: string;
  /** 逐日 × 分类矩阵（dailyByCategory 输出） */
  daily: DailyByCategory;
  /** 堆叠层顺序（categoryId key，按时长降序；"unlogged" 应在最后 = 堆叠顶层） */
  stackKeys: string[];
  /** 分类色（key 为 categoryId；查表 + paletteColor 回退由调用方完成） */
  categoryColorOf: (categoryId: string | null, categoryName: string) => string;
  /** X 轴刻度文案 */
  xTickFormatter: (date: string) => string;
  /** tooltip 首行日期文案 */
  tooltipDateLabel: (date: string) => string;
  /** X 轴刻度密度（天数多时传 "preserveStartEnd" 抽稀） */
  interval?: number | "preserveStartEnd";
  /** 图表高度 class（默认 h-64） */
  heightClassName?: string;
};

/** 逐日分类堆叠构成柱（共享于周视图 / 自定义视图）。
 * 每根柱 = 当天窗口的构成条（covered + unlogged = windowSeconds，
 * 完整记录前提下柱高天然近似等高，信息在分层比例）；未记录灰段为顶层。 */
export function StackedCompositionChart(props: StackedCompositionChartProps) {
  const { t } = useTranslation();
  const { daily, stackKeys } = props;

  const nameOf = (key: string) =>
    key === "unlogged"
      ? t("stats.unlogged")
      : (daily.categoryNames[key] ?? key);
  const colorOf = (key: string) =>
    key === "unlogged"
      ? UNLOGGED_COLOR
      : props.categoryColorOf(
          key === NULL_CATEGORY_KEY ? null : key,
          daily.categoryNames[key] ?? key,
        );

  const barData = daily.days.map((d) => ({
    date: d.date,
    ...d.categories,
    unlogged: d.unlogged,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`min-w-0 ${props.heightClassName ?? "h-64"}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={(d) => props.xTickFormatter(String(d))}
                interval={props.interval}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tickMargin={8}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const day = daily.days.find((d) => d.date === label);
                  if (!day) return null;
                  return (
                    <div className="px-2 py-1 text-xs" style={TOOLTIP_STYLE}>
                      <p className="font-semibold">
                        {props.tooltipDateLabel(day.date)}
                      </p>
                      {payload
                        .filter((p) => Number(p.value) > 0)
                        .sort((a, b) => Number(b.value) - Number(a.value))
                        .map((p) => {
                          const key = String(p.dataKey);
                          return (
                            <p key={key}>
                              {nameOf(key)} ·{" "}
                              {formatDuration(Number(p.value))}
                            </p>
                          );
                        })}
                    </div>
                  );
                }}
              />
              {stackKeys.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="composition"
                  fill={colorOf(key)}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* 图例：堆叠层顺序（分类按时长降序 + 未记录） */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {stackKeys.map((key) => (
            <span
              key={key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: colorOf(key) }}
              />
              {nameOf(key)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
