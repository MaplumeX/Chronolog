# 重构组件与布局设计

## Goal

用 Tailwind CSS v4 + shadcn/ui 重做 Chronolog 前端的组件与布局：浅色中性灰、无卡片、可折叠左栏，窄屏为抽屉。记时模型、三页信息架构、中文文案与现有开始/停止/分类/统计/时间线行为保持不变。

用户价值：界面不再像白卡片浮在米色底上的通用后台；收起侧栏后时间线更宽；窄屏也能打开同一组导航。

## Background

用户原话：重构该项目的组件、布局设计。分支已是 `feat/restructure-components-layout`。产品决策见 Requirements。

仓库事实：

- SPA 在 `web/`：Vite 8、React 19、无 Router、无状态库。现样式集中在 `web/src/styles.css`。
- 共享组件目前只有 `Shell.tsx`。`TimerPage` 内含计时条、分类下拉和 `TimelineSection`。
- `App.tsx` 持有 session、`PageId`、运行中计时、`nowMs`。运行时长同时出现在左栏「计时」和计时条。
- 未登录只渲染 `AuthPage`。导航固定为计时 / 统计 / 分类。
- Tailwind v4 + shadcn 在 Vite 上的官方路径见 `research/tailwind-v4-shadcn-vite.md`；Sidebar 组成见 `research/shadcn-sidebar.md`。
- 分类色仍由 `format.ts` 的 `categoryColor` 哈希得出，不入库。

## Requirements

- R1. 已登录导航仍是「计时 / 统计 / 分类」，不新增页面。未登录不显示壳层。
- R2. 界面语言保持中文。
- R3. 开始/停止、分类增改删、今日分类合计、时间线定位与时长计算与改版前一致。分类合计只出现在统计页。
- R4. `web/` 使用 Tailwind CSS v4（`@tailwindcss/vite`）和 shadcn/ui（源码拷入 `components/ui`）。
- R5. 主界面（登录页 + 三页）不用白底圆角投影卡片作为默认分组；用间距、分割线和表面色区分区域。不引入 shadcn `Card` 作为页面骨架。
- R6. 已登录使用可折叠左栏：品牌、三项导航、用户名、退出。运行中在「计时」项显示已用时。桌面收起后为图标轨，主区变宽。
- R7. 全应用浅色。背景与侧栏同属中性灰，侧栏可比主区略深，但不是深色反色栏，也不是米色底。无主题开关。
- R8. 窄屏（约 `<768px`）左栏改为抽屉：默认收起，通过触发按钮打开，内含与桌面相同的导航、用户名和退出。打开抽屉后可以切换页面并关闭。
- R9. 从页面中抽出可复用块：`Shell`、计时条、分类选择、时间线。页面文件只编排，不把时间线整段留在 `TimerPage` 里。

## Acceptance Criteria

- [ ] AC1. 生产构建使用 Tailwind v4 + shadcn 组件；`auth-card` / `timeline-card` / `stats-card` / `table-card` 不再作为页面结构（R4、R5）。
- [ ] AC2. 登录后仍只有计时 / 统计 / 分类；未登录仍只有登录/注册（R1、R2）。
- [ ] AC3. 开始/停止、分类增改删（含占用不可删）、今日分类合计、时间线色块位置/时长/运行中增长/当前时刻线与改版前一致；计时页仍无分类合计（R3）。
- [ ] AC4. 桌面左栏可在文字导航与图标轨之间切换；收起后主区变宽；运行中「计时」仍能看出已用时（R6）。
- [ ] AC5. 登录页与已登录三页均为浅色中性灰，无米色卡片底，无整页深色反转（R5、R7）。
- [ ] AC6. 窄屏壳层为抽屉：能打开、切换三项、看到用户名并退出，不必靠桌面宽度的固定侧栏（R8）。
- [ ] AC7. 计时条、分类选择、时间线各自是 `components/` 下的模块，不在 `TimerPage.tsx` 内联整段时间线（R9）。

## Out of scope

- 后端 API、数据库、鉴权 cookie 语义。
- 新功能：周/月报、日历、事后补记、拖拽编辑时间块、项目/标签。
- React Router、Redux/Zustand、React Query。
- 深色模式、主题切换、跟随系统。
- 独立原生移动应用。
- 把 `sid` 存进 `localStorage`。
