# Implement: Timeline drag-to-create entry

## 执行顺序

### 1. 后端：POST /api/entries

- [ ] `server/src/routes/entries.ts`：提取/共享校验逻辑，新增 `POST /api/entries`（201 + EntryDto；校验顺序：时间合法 → 分类 → 标签 → OVERLAP）。
- [ ] `server/test/entries.test.ts` 追加 create 用例：
  - 正常创建 201、today 可见
  - `stoppedAt <= startedAt` → 400 `VALIDATION`
  - 分类/标签不存在或他人所有 → 404
  - 重叠 → 409 `OVERLAP`；边界相接 → 成功
  - 跨用户隔离 → 404
- 验证：`npm test -w server`（或项目现有测试命令）

### 2. API client

- [ ] `web/src/api.ts` 增加 `createEntry`。

### 3. EntryEditor 草稿模式

- [ ] Props 二选一：`entry`（编辑）或 `draft`（新建：`{ startedAt, stoppedAt }`）。
- [ ] 新建模式：categoryId 初始 `""`，未选类别时保存按钮禁用（或提交前校验提示）。
- [ ] 保存调用 `api.createEntry`；OVERLAP 处理复用现有逻辑。
- [ ] i18n zh/en 新 key 同步。

### 4. Timeline 拖拽创建

- [ ] snap 映射表 `{60:15, 30:10, 15:5, 5:1}` 分钟；snap 函数 + 不足一格按一格。
- [ ] `DayColumn` track pointerdown/move/up + setPointerCapture；色块命中则忽略（`closest(".timeline-block")`）。
- [ ] 预览块渲染（`.timeline-block.drag-preview`，styles.css 新样式）。
- [ ] 草稿状态提升到 `Timeline`，Popover + EntryEditor（draft 模式）打开；保存/取消后清理。
- [ ] week 模式：草稿带 `dayStart`，创建时归属该列。

### 5. 联调验证（对照 AC）

- [ ] AC1 day 拖 10:00–11:30 → 编辑器预填正确 → 保存后显示。
- [ ] AC2 week 拖某列 → 归属该日。
- [ ] AC3 预览块实时 + 显示时间。
- [ ] AC4 重叠保存 → OVERLAP 错误显示。
- [ ] AC5 点击空白不创建。
- [ ] AC6 取消不产生数据。
- [ ] AC7 四档 snap 正确。
- [ ] AC8 色块点击不受影响。
- [ ] AC10 未选类别不能保存。

## 验证命令

```bash
npm test -w server
npm run typecheck -w web
npm run build -w web
```

## 风险文件 / 回滚点

- `web/src/components/Timeline.tsx`（最大改动面；day/week 共用逻辑，改坏影响现有展示）→ 分两个 commit：后端先行、前端交互其次，出问题可单独 revert 前端。
- `server/src/routes/entries.ts`（重构校验链时勿改变 PATCH 行为）→ entries.test.ts 全量跑。