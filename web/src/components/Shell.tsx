import type { ReactNode } from "react";
import { formatDuration } from "../format";

export type PageId = "timer" | "stats" | "categories";

const ITEMS: { id: PageId; label: string }[] = [
  { id: "timer", label: "计时" },
  { id: "stats", label: "统计" },
  { id: "categories", label: "分类" },
];

export function Shell(props: {
  username: string;
  page: PageId;
  elapsedSeconds?: number;
  onPage: (page: PageId) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="nav">
        <div className="brand">Chronolog</div>
        <div className="nav-list">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item${props.page === item.id ? " active" : ""}`}
              onClick={() => props.onPage(item.id)}
              type="button"
            >
              <span>{item.label}</span>
              {item.id === "timer" && props.elapsedSeconds != null ? (
                <span className="nav-elapsed">{formatDuration(props.elapsedSeconds)}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="nav-foot">
          <span>{props.username}</span>
          <button type="button" onClick={props.onLogout}>
            退出
          </button>
        </div>
      </aside>
      <main className="main">{props.children}</main>
    </div>
  );
}
