# Research: Toggl Track 网页实际布局（2025–2026）

- Query: 对照官方 Timer / List view 截图，Chronolog 桌面 Web 应抄什么。
- Date: 2026-08-26
- Sources:
  - https://support.toggl.com/en-us/article/the-timer-page-x46p31/
  - https://support.toggl.com/en-us/article/tracking-time-in-list-view-1pt3xo2/
  - 官方图：Timer page 全页、List view、右侧栏（HubSpot Knowledge Base，2025-10）

## 实际页面（不是猜的）

Timer 页是 **桌面应用壳**，不是单列 App：

1. **左侧深色导航（全高）**  
   紫黑底。顶上工作区名。TRACK：Timer（计时中会在该项上显示 `4:01:12`）。其下 ANALYZE / MANAGE（Reports、Projects、Clients、Tags…）。

2. **顶栏计时条（白、拉满主区宽）**  
   左：说明（空闲时灰字 *What are you working on?*；计时中是标题）。  
   右：彩色项目胶囊（圆点 + 项目名 + 客户）→ 标签图标 → `$` → **等宽已过时间** → **圆形播放/停止**（空闲粉紫 Play，计时中红 Stop）。

3. **工具条**  
   左：周期选择 `This week · W18`。  
   右：分段按钮 Calendar | **List view** | Timesheet，再齿轮和右侧栏开关。

4. **主列表（白卡片，行高密）**  
   按日分组。日标题左对齐（Today / Yesterday），**日合计右对齐**（`9:00:35`）。  
   每行：说明（可空成 Add description）| 彩色项目名 | `$` | `18:07 - 18:07` | 时长。时间和时长贴右。日块之间是浅米色页底，不是一张连表。

5. **右侧可折叠栏**  
   小卡片：本周已计时间、今日/本周 billable、Goals、Favorites。不是和主区对等的第三列「图表墙」。

页底是浅米色（`#F8F5F2` 一类），主列表和顶栏是白。视觉密度高，横向空间全用上。

## Chronolog MVP 怎么抄

抄壳和密度，不抄团队/计费功能。

| Toggl | Chronolog 第一版 |
|---|---|
| 深色左栏 TRACK：Timer | 左栏 **计时** |
| 深色左栏 ANALYZE：Reports | 左栏 **统计**（今日分类合计，不是计时页侧栏） |
| 深色左栏 MANAGE：Projects | 左栏 **分类** |
| 顶栏说明 + 项目胶囊 + Play/Stop | 顶栏说明 + **必选分类胶囊** + 时间 + 圆按钮 |
| List view 按日分组 | 计时页只做 **今天** 一组（无周切换、无日历/timesheet） |
| 行：说明 / 项目 / 起止 / 时长 | 行：说明 / 分类 / 起止 / 时长 |
| 右侧 billable / goals / favorites | **不要**。合计不放计时页 |
| Reports 页看项目汇总 | **统计页**看今日分类合计 |

明确不做（Toggl 有、本版没有）：Calendar、Timesheet、周选择器、`$`、标签、行内 Continue、Favorites、Goals、Focus mode、批量编辑。

## 视觉（学结构，不抄品牌粉）

- 左栏深色（炭/墨，不要 Toggl 商标紫）
- 主区浅米色底 + 白顶栏 + 白日列表
- 开始：圆钮；停止：红圆钮（Toggl 计时中的 Stop 就是这样）
- 分类名带色点，像 Toggl 的项目名
- 时长等宽、右对齐

## 实现时不要做的

- 单列居中卡片流（像手机 App）
- 三栏等宽仪表盘
- 把分类做成工具条里的原生 `<select>`
- 大图表占主区
