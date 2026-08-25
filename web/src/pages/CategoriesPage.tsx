import { useEffect, useState } from "react";
import { ApiError, api, type Category } from "../api";
import { categoryColor } from "../format";

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const res = await api.categories();
    setCategories(res.categories);
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof ApiError ? err.message : "加载失败"));
  }, []);

  async function create() {
    setError("");
    try {
      await api.createCategory(name);
      setName("");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建失败");
    }
  }

  async function save(id: string) {
    setError("");
    try {
      await api.renameCategory(id, editName);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "重命名失败");
    }
  }

  async function remove(c: Category) {
    setError("");
    try {
      await api.deleteCategory(c.id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除失败");
    }
  }

  return (
    <>
      <h1 className="page-title">分类</h1>
      <div className="toolbar">
        <input
          value={name}
          placeholder="新分类名称"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
        />
        <button className="ghost" type="button" onClick={create} disabled={!name.trim()}>
          添加
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="table-card">
        <table className="cat-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>记录数</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  {editing === c.id ? (
                    <div className="inline">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => save(c.id)}
                        disabled={!editName.trim()}
                      >
                        保存
                      </button>
                      <button className="ghost" type="button" onClick={() => setEditing(null)}>
                        取消
                      </button>
                    </div>
                  ) : (
                    <span className="inline">
                      <span className="dot" style={{ background: categoryColor(c.name) }} />
                      {c.name}
                    </span>
                  )}
                </td>
                <td>{c.entryCount}</td>
                <td>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      setEditing(c.id);
                      setEditName(c.name);
                    }}
                  >
                    重命名
                  </button>
                  <button
                    className="danger"
                    type="button"
                    onClick={() => remove(c)}
                    disabled={c.entryCount > 0}
                    title={c.entryCount > 0 ? "该分类仍有时间记录，无法删除" : "删除"}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
