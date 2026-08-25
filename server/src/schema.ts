import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("users_username_unique").on(t.username)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("sessions_user_id").on(t.userId),
    index("sessions_expires_at").on(t.expiresAt),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("categories_user_id_name").on(t.userId, t.name)],
);

export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    description: text("description").notNull().default(""),
    startedAt: text("started_at").notNull(),
    stoppedAt: text("stopped_at"),
  },
  (t) => [
    index("time_entries_user_started").on(t.userId, t.startedAt),
    uniqueIndex("time_entries_one_running")
      .on(t.userId)
      .where(sql`${t.stoppedAt} is null`),
  ],
);

export const DEFAULT_CATEGORIES = ["工作", "学习", "休息", "事务"] as const;
