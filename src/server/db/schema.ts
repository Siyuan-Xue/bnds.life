import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  bigint,
  jsonb,
  index,
  uniqueIndex,
  check,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const mediaVideos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey(),
    title: text("title").notNull(),
    story: text("story"),
    recordedDate: text("recorded_date"),
    status: text("status").notNull().default("draft"),
    sourceSha256: text("source_sha256").notNull().unique(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("videos_browse_idx").on(t.status, t.recordedDate),
    check(
      "videos_status_check",
      sql`${t.status} IN ('draft', 'published', 'hidden')`,
    ),
  ],
);

export const videoAssets = pgTable(
  "video_assets",
  {
    id: uuid("id").primaryKey(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => mediaVideos.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    objectKey: text("object_key").notNull(),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: bigint("duration_ms", { mode: "number" }),
    processingMethod: text("processing_method").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("video_assets_kind_idx").on(t.videoId, t.kind),
    check(
      "video_assets_kind_check",
      sql`${t.kind} IN ('original', 'playback', 'poster', 'native')`,
    ),
  ],
);

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    isOfficial: boolean("is_official").notNull().default(false),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified")
      .$defaultFn(() => false)
      .notNull(),
    image: text("image"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("user_one_official_idx")
      .on(t.isOfficial)
      .where(sql`${t.isOfficial} = true`),
    uniqueIndex("user_email_lower_idx").on(sql`lower(${t.email})`),
  ],
);

export const videoComments = pgTable(
  "video_comments",
  {
    id: uuid("id").primaryKey(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => mediaVideos.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    isStory: boolean("is_story").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("video_comments_browse_idx").on(t.videoId, t.parentId, t.createdAt),
    index("video_comments_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("video_comments_one_story_idx")
      .on(t.videoId)
      .where(sql`${t.isStory}`),
    check(
      "video_comments_story_root_check",
      sql`NOT ${t.isStory} OR ${t.parentId} IS NULL`,
    ),
    unique("video_comments_id_video_id_key").on(t.id, t.videoId),
    foreignKey({
      columns: [t.parentId, t.videoId],
      foreignColumns: [t.id, t.videoId],
    }).onDelete("cascade"),
    check(
      "video_comments_body_check",
      sql`length(trim(${t.body})) BETWEEN 1 AND CASE WHEN ${t.isStory} THEN 100000 ELSE 5000 END`,
    ),
  ],
);

export const videoDeletionJobs = pgTable("video_deletion_jobs", {
  id: uuid("id").primaryKey(),
  videoId: uuid("video_id").notNull().unique(),
  videoTitle: text("video_title").notNull().default("视频"),
  sourceSha256: text("source_sha256").notNull(),
  requestedBy: text("requested_by").notNull(),
  status: text("status")
    .$type<"pending" | "running" | "complete" | "failed">()
    .notNull()
    .default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const deletedVideoSources = pgTable("deleted_video_sources", {
  sourceSha256: text("source_sha256").primaryKey(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
});

export const userRelations = relations(user, ({ many }) => ({
  account: many(account),
  session: many(session),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
