import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name"),
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
    color: integer("color"),
    parentId: text("parent_id"), // 两级层级：指向同表同用户顶层节点；NULL = 顶层。唯一性（同父下重名）由应用层校验
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("categories_user_parent").on(t.userId, t.parentId)],
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

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: integer("color"),
    parentId: text("parent_id"), // 两级层级：指向同表同用户顶层节点；NULL = 顶层
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("tags_user_parent").on(t.userId, t.parentId)],
);

export const entryTags = sqliteTable(
  "entry_tags",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => timeEntries.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.tagId] }),
    index("entry_tags_tag_id").on(t.tagId),
  ],
);

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at"),
  },
  (t) => [
    uniqueIndex("api_tokens_token_hash").on(t.tokenHash),
    index("api_tokens_user_id").on(t.userId),
  ],
);

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("🎯"),
    categoryId: text("category_id").references(() => categories.id),
    tagId: text("tag_id").references(() => tags.id),
    direction: text("direction").notNull(), // 'lt' | 'gt'
    hours: real("hours").notNull(),
    periodUnit: text("period_unit").notNull(), // 'day' | 'week' | 'month'
    dueDate: text("due_date"), // 'YYYY-MM-DD'，tz 相关语义，存原样
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("goals_user_id").on(t.userId)],
);

export const DEFAULT_CATEGORIES = ["工作", "学习", "休息", "事务"] as const;
