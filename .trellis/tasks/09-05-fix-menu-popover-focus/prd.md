# Fix row-menu popover closing instantly after add-child/edit

## Background

Task 09-01-row-actions-menu (#35) collapsed the tree-list row actions into a
`⋯` dropdown menu. Menu items 添加子级/编辑 close the menu and open the old
popovers via a row-level controlled `Popover` + `PopoverAnchor virtualRef`
pinned to the `⋯` button.

After #35 shipped, clicking 添加子级 or 编辑 in a real browser flashes the
popover open and it immediately closes — the buttons appear dead. jsdom tests
(19 tests, all green) never catch it because they have no real pointer/focus
timing.

## Root cause (verified in Chromium via Playwright event tracing)

1. Menu item click → `onSelect` sets `popoverTarget` → Popover mounts, form
   input receives focus.
2. The user's pointer leaves the menu item right after the click → Radix
   `MenuItem` `onPointerLeave` → `onItemLeave` → `contentRef.current?.focus()`
   steals focus back to the already-closing menu container.
3. That `focusin` lands outside the freshly opened popover → Popover's
   DismissableLayer treats it as focus-outside → `onOpenChange(false)` →
   popover closes instantly.

Because the popover is anchored with `PopoverAnchor virtualRef` (not
`PopoverTrigger`), Radix's built-in `targetIsTrigger` exemption never fires,
so nothing suppresses the dismissal.

## Fix (implemented in this session)

In `HierarchicalListCard.tsx`:

- Record the popover open timestamp (`popoverOpenedAtRef`) when a menu item's
  `onSelect` sets `popoverTarget` (both addChild and edit).
- Pass `onFocusOutside={guardPopoverFocusOutside}` to both `PopoverContent`
  instances: focus-outside events within ~300ms of open are prevented —
  covering the menu teardown focus handoffs (`onCloseAutoFocus` → `⋯` button,
  `onItemLeave` → menu container) so the popover survives.

## Acceptance criteria

- [x] In a real browser (Chromium), clicking 添加子级 opens the popover and it
      stays open; creating a child works end-to-end.
- [x] In a real browser, clicking 编辑 opens the popover and it stays open;
      renaming + save works end-to-end.
- [x] Existing dismiss semantics intact: outside click closes the popover,
      Escape closes it, reopening a second time works.
- [x] Full web test suite passes (120/120) and typecheck passes.

## Out of scope

- Any change to the dropdown menu ordering, confirm dialogs, or archive flows.
- Radix version bumps or ui/ primitive changes.
