import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  boolean,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Crypto Projects ──────────────────────────────────────────────────────────
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  // Basic info
  name: varchar("name", { length: 255 }).notNull(),
  symbol: varchar("symbol", { length: 32 }).notNull(),
  slug: varchar("slug", { length: 255 }),
  description: text("description"),
  logoUrl: varchar("logoUrl", { length: 512 }),
  // Source
  source: mysqlEnum("source", ["coinmarketcap", "coingecko", "manual"]).notNull().default("manual"),
  sourceId: varchar("sourceId", { length: 128 }), // CMC/CG internal id
  // Classification
  isMeme: boolean("isMeme").default(false).notNull(),
  category: varchar("category", { length: 128 }), // meme, defi, gamefi, nft, layer2, etc.
  tags: json("tags").$type<string[]>(),
  // Market data
  marketCap: decimal("marketCap", { precision: 20, scale: 2 }),
  price: decimal("price", { precision: 20, scale: 8 }),
  volume24h: decimal("volume24h", { precision: 20, scale: 2 }),
  rank: int("rank"),
  chain: varchar("chain", { length: 64 }), // ethereum, solana, bsc, etc.
  contractAddress: varchar("contractAddress", { length: 255 }),
  // Contact channels
  website: varchar("website", { length: 512 }),
  twitterHandle: varchar("twitterHandle", { length: 128 }),
  twitterUrl: varchar("twitterUrl", { length: 512 }),
  telegramUrl: varchar("telegramUrl", { length: 512 }),
  discordUrl: varchar("discordUrl", { length: 512 }),
  officialEmail: varchar("officialEmail", { length: 320 }),
  contactPersonName: varchar("contactPersonName", { length: 255 }),
  contactPersonTg: varchar("contactPersonTg", { length: 128 }),
  // Status
  status: mysqlEnum("status", [
    "discovered",   // 刚发现，待联系
    "contacted",    // 已联系
    "replied",      // 已回复
    "negotiating",  // 洽谈中
    "listed",       // 已成交/上币
    "rejected",     // 已拒绝
    "blacklisted",  // 已拉黑
  ]).default("discovered").notNull(),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium").notNull(),
  notes: text("notes"),
  listingFee: decimal("listingFee", { precision: 20, scale: 2 }),
  listingFeeCurrency: varchar("listingFeeCurrency", { length: 16 }),
  // Timestamps
  listedOnSourceAt: timestamp("listedOnSourceAt"),
  firstContactAt: timestamp("firstContactAt"),
  lastContactAt: timestamp("lastContactAt"),
  lastReplyAt: timestamp("lastReplyAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Managed Accounts (X / Telegram / Email) ─────────────────────────────────
export const accounts = mysqlTable("accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["twitter", "telegram", "email"]).notNull(),
  label: varchar("label", { length: 128 }).notNull(), // display name
  handle: varchar("handle", { length: 255 }).notNull(), // @username or email address
  // Credentials / tokens (stored encrypted in production)
  credentials: json("credentials").$type<Record<string, string>>(),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  dailyLimit: int("dailyLimit").default(50).notNull(), // max messages per day
  sentToday: int("sentToday").default(0).notNull(),
  lastResetAt: timestamp("lastResetAt").defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;

// ─── Message Templates ────────────────────────────────────────────────────────
export const templates = mysqlTable("templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  scenario: mysqlEnum("scenario", [
    "first_contact",  // 首次联系
    "follow_up",      // 跟进
    "quote",          // 报价
    "negotiation",    // 洽谈
    "closing",        // 成交确认
  ]).notNull().default("first_contact"),
  channel: mysqlEnum("channel", ["twitter", "telegram", "email", "all"]).default("all").notNull(),
  subject: varchar("subject", { length: 512 }), // for email
  bodyEn: text("bodyEn").notNull(), // English template
  bodyCn: text("bodyCn"),           // Chinese translation
  variables: json("variables").$type<string[]>(), // e.g. ["projectName", "symbol"]
  isDefault: boolean("isDefault").default(false).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

// ─── Contact Messages ─────────────────────────────────────────────────────────
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  accountId: int("accountId"),
  templateId: int("templateId"),
  // Direction
  direction: mysqlEnum("direction", ["outbound", "inbound"]).notNull().default("outbound"),
  channel: mysqlEnum("channel", ["twitter", "telegram", "email", "discord", "manual"]).notNull(),
  // Content
  subject: varchar("subject", { length: 512 }),
  bodyEn: text("bodyEn").notNull(),
  bodyCn: text("bodyCn"),
  // Status
  status: mysqlEnum("status", [
    "pending",    // 待发送
    "sent",       // 已发送
    "delivered",  // 已送达
    "read",       // 已读
    "replied",    // 已回复
    "failed",     // 发送失败
    "bounced",    // 退信
  ]).default("pending").notNull(),
  // Follow-up tracking
  isFollowUp: boolean("isFollowUp").default(false).notNull(),
  followUpNumber: int("followUpNumber").default(1).notNull(), // 1=first, 2=second follow-up
  // LLM analysis
  replyIntent: varchar("replyIntent", { length: 64 }), // interested, neutral, rejected, question
  replysentiment: varchar("replysentiment", { length: 32 }), // positive, neutral, negative
  llmSuggestion: text("llmSuggestion"), // AI-generated follow-up suggestion
  llmSuggestionCn: text("llmSuggestionCn"),
  // Timestamps
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  readAt: timestamp("readAt"),
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Daily Analytics Snapshots ────────────────────────────────────────────────
export const analytics = mysqlTable("analytics", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 16 }).notNull().unique(), // YYYY-MM-DD
  // Counts
  projectsDiscovered: int("projectsDiscovered").default(0).notNull(),
  projectsContacted: int("projectsContacted").default(0).notNull(),
  projectsReplied: int("projectsReplied").default(0).notNull(),
  projectsListed: int("projectsListed").default(0).notNull(),
  projectsRejected: int("projectsRejected").default(0).notNull(),
  messagesSent: int("messagesSent").default(0).notNull(),
  messagesReceived: int("messagesReceived").default(0).notNull(),
  followUpsSent: int("followUpsSent").default(0).notNull(),
  // Revenue
  listingFeeTotal: decimal("listingFeeTotal", { precision: 20, scale: 2 }).default("0"),
  listingFeeCurrency: varchar("listingFeeCurrency", { length: 16 }).default("USDT"),
  // Rates (stored as percentage 0-100)
  replyRate: decimal("replyRate", { precision: 5, scale: 2 }).default("0"),
  conversionRate: decimal("conversionRate", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Analytics = typeof analytics.$inferSelect;

// ─── System Settings ──────────────────────────────────────────────────────────
export const settings = mysqlTable("settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  key: varchar("key", { length: 128 }).notNull(),
  value: text("value"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
