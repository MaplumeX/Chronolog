import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

export type Deps = {
  db: Db;
  sqlite: InstanceType<typeof Database>;
  cookieSecure: boolean;
  sessionTtlSeconds: number;
  registrationOpen: boolean;
  now: () => Date;
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color INTEGER,
  parent_id TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id),
  description TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  stopped_at TEXT
);
CREATE INDEX IF NOT EXISTS time_entries_user_started ON time_entries(user_id, started_at);
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_running
  ON time_entries(user_id) WHERE stopped_at IS NULL;

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color INTEGER,
  parent_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS entry_tags_tag_id ON entry_tags(tag_id);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS api_tokens_user_id ON api_tokens(user_id);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  category_id TEXT REFERENCES categories(id),
  tag_id TEXT REFERENCES tags(id),
  direction TEXT NOT NULL,
  hours REAL NOT NULL,
  period_unit TEXT NOT NULL,
  due_date TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS goals_user_id ON goals(user_id);
`;

export function openDb(dbPath: string): { sqlite: InstanceType<typeof Database>; db: Db } {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.exec(SCHEMA_SQL);
  migrate(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

/** Idempotent column migrations for databases created before a schema change. */
function migrate(sqlite: InstanceType<typeof Database>) {
  const userCols = (sqlite.pragma("table_info(users)") as { name: string }[]).map(
    (c) => c.name,
  );
  if (!userCols.includes("display_name")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
  }

  const categoryCols = (sqlite.pragma("table_info(categories)") as { name: string }[]).map(
    (c) => c.name,
  );
  if (!categoryCols.includes("color")) {
    sqlite.exec("ALTER TABLE categories ADD COLUMN color INTEGER");
  }
  if (!categoryCols.includes("parent_id")) {
    sqlite.exec("ALTER TABLE categories ADD COLUMN parent_id TEXT");
  }
  if (!categoryCols.includes("archived_at")) {
    sqlite.exec("ALTER TABLE categories ADD COLUMN archived_at TEXT");
  }
  // 新库（SCHEMA_SQL 已建列）与老库（ALTER 后）都在这里建索引，幂等
  sqlite.exec("CREATE INDEX IF NOT EXISTS categories_user_parent ON categories(user_id, parent_id)");
  // 唯一性放宽为「同父下重名」由应用层校验；旧库的 (user_id, name) 唯一索引必须删除，否则跨父重名会撞索引
  sqlite.exec("DROP INDEX IF EXISTS categories_user_id_name");

  // time_entries.category_id 去 NOT NULL：SQLite 无法直接去 NOT NULL，按官方 12-step 流程重建表
  const entryCategoryCol = (sqlite.pragma("table_info(time_entries)") as { name: string; notnull: number }[]).find(
    (c) => c.name === "category_id",
  );
  if (entryCategoryCol?.notnull === 1) {
    sqlite.pragma("foreign_keys = OFF");
    try {
      sqlite.exec("BEGIN");
      sqlite.exec(`
        CREATE TABLE time_entries_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category_id TEXT REFERENCES categories(id),
          description TEXT NOT NULL DEFAULT '',
          started_at TEXT NOT NULL,
          stopped_at TEXT
        );
        INSERT INTO time_entries_new (id, user_id, category_id, description, started_at, stopped_at)
          SELECT id, user_id, category_id, description, started_at, stopped_at FROM time_entries;
        DROP TABLE time_entries;
      `);
      // legacy_alter_table = ON 时 RENAME 不改写其它表（entry_tags）的 FK 定义，保持其指向 time_entries
      sqlite.pragma("legacy_alter_table = ON");
      try {
        sqlite.exec("ALTER TABLE time_entries_new RENAME TO time_entries");
      } finally {
        sqlite.pragma("legacy_alter_table = OFF");
      }
      sqlite.exec(
        "CREATE INDEX IF NOT EXISTS time_entries_user_started ON time_entries(user_id, started_at)",
      );
      sqlite.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_running ON time_entries(user_id) WHERE stopped_at IS NULL",
      );
      sqlite.exec("COMMIT");
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    } finally {
      sqlite.pragma("foreign_keys = ON");
    }
  }

  const tagCols = (sqlite.pragma("table_info(tags)") as { name: string }[]).map(
    (c) => c.name,
  );
  if (!tagCols.includes("color")) {
    sqlite.exec("ALTER TABLE tags ADD COLUMN color INTEGER");
  }
  if (!tagCols.includes("parent_id")) {
    sqlite.exec("ALTER TABLE tags ADD COLUMN parent_id TEXT");
  }
  sqlite.exec("CREATE INDEX IF NOT EXISTS tags_user_parent ON tags(user_id, parent_id)");
  sqlite.exec("DROP INDEX IF EXISTS tags_user_id_name");
}
