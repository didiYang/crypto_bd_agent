import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Account,
  Analytics,
  InsertAccount,
  InsertMessage,
  InsertProject,
  InsertTemplate,
  InsertUser,
  Message,
  Project,
  Setting,
  Template,
  accounts,
  analytics,
  messages,
  projects,
  settings,
  templates,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function listProjects(filters?: {
  status?: string;
  isMeme?: boolean;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (filters?.status) conditions.push(eq(projects.status, filters.status as Project["status"]));
  if (filters?.isMeme !== undefined) conditions.push(eq(projects.isMeme, filters.isMeme));
  if (filters?.source) conditions.push(eq(projects.source, filters.source as Project["source"]));
  if (filters?.search) {
    conditions.push(
      or(
        sql`${projects.name} LIKE ${`%${filters.search}%`}`,
        sql`${projects.symbol} LIKE ${`%${filters.search}%`}`
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const [items, countResult] = await Promise.all([
    db.select().from(projects).where(where).orderBy(desc(projects.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(projects).where(where),
  ]);

  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(projects).values(data);
  const result = await db.select().from(projects).orderBy(desc(projects.id)).limit(1);
  return result[0];
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(projects).set(data).where(eq(projects.id, id));
  return getProjectById(id);
}

export async function getProjectsNeedingFollowUp() {
  const db = await getDb();
  if (!db) return [];
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  // Projects that were contacted but not replied, and last contact was 2+ days ago
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.status, "contacted"),
        lte(projects.lastContactAt, twoDaysAgo)
      )
    )
    .orderBy(projects.lastContactAt);
}

export async function getProjectBySourceId(sourceId: string, source: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.sourceId, sourceId), eq(projects.source, source as Project["source"])))
    .limit(1);
  return result[0];
}

// ─── Accounts ─────────────────────────────────────────────────────────────────
export async function listAccounts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.type);
}

export async function getAccountById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return result[0];
}

export async function createAccount(data: InsertAccount) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(accounts).values(data);
  const result = await db.select().from(accounts).orderBy(desc(accounts.id)).limit(1);
  return result[0];
}

export async function updateAccount(id: number, data: Partial<InsertAccount>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accounts).set(data).where(eq(accounts.id, id));
  return getAccountById(id);
}

export async function deleteAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accounts).where(eq(accounts.id, id));
}

export async function getAvailableAccount(type: Account["type"]) {
  const db = await getDb();
  if (!db) return undefined;
  // Get an active account that hasn't exceeded daily limit
  const result = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.type, type),
        eq(accounts.isActive, true),
        sql`${accounts.sentToday} < ${accounts.dailyLimit}`
      )
    )
    .orderBy(accounts.sentToday)
    .limit(1);
  return result[0];
}

export async function resetDailyCounts() {
  const db = await getDb();
  if (!db) return;
  await db.update(accounts).set({ sentToday: 0, lastResetAt: new Date() });
}

// ─── Templates ────────────────────────────────────────────────────────────────
export async function listTemplates(userId: number, scenario?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(templates.userId, userId)];
  if (scenario) conditions.push(eq(templates.scenario, scenario as Template["scenario"]));
  return db.select().from(templates).where(and(...conditions)).orderBy(desc(templates.usageCount));
}

export async function getTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
  return result[0];
}

export async function createTemplate(data: InsertTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(templates).values(data);
  const result = await db.select().from(templates).orderBy(desc(templates.id)).limit(1);
  return result[0];
}

export async function updateTemplate(id: number, data: Partial<InsertTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(templates).set(data).where(eq(templates.id, id));
  return getTemplateById(id);
}

export async function deleteTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(templates).where(eq(templates.id, id));
}

export async function getDefaultTemplate(scenario: Template["scenario"]) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(templates)
    .where(and(eq(templates.scenario, scenario), eq(templates.isDefault, true)))
    .limit(1);
  return result[0];
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export async function listMessages(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.projectId, projectId)).orderBy(messages.createdAt);
}

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(messages).values(data);
  const result = await db.select().from(messages).orderBy(desc(messages.id)).limit(1);
  return result[0];
}

export async function updateMessage(id: number, data: Partial<InsertMessage>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(messages).set(data).where(eq(messages.id, id));
}

export async function getLastOutboundMessage(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(messages)
    .where(and(eq(messages.projectId, projectId), eq(messages.direction, "outbound")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return result[0];
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getOrCreateAnalytics(date: string): Promise<Analytics> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select().from(analytics).where(eq(analytics.date, date)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(analytics).values({ date });
  const result = await db.select().from(analytics).where(eq(analytics.date, date)).limit(1);
  return result[0]!;
}

export async function updateAnalytics(date: string, data: Partial<Analytics>) {
  const db = await getDb();
  if (!db) return;
  await db.update(analytics).set(data).where(eq(analytics.date, date));
}

export async function getAnalyticsRange(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(analytics)
    .where(and(gte(analytics.date, startDate), lte(analytics.date, endDate)))
    .orderBy(analytics.date);
}

export async function getAnalyticsSummary() {
  const db = await getDb();
  if (!db) return null;
  const [projectStats, messageStats] = await Promise.all([
    db.select({
      total: sql<number>`count(*)`,
      contacted: sql<number>`sum(case when status != 'discovered' then 1 else 0 end)`,
      replied: sql<number>`sum(case when status in ('replied','negotiating','listed') then 1 else 0 end)`,
      listed: sql<number>`sum(case when status = 'listed' then 1 else 0 end)`,
      rejected: sql<number>`sum(case when status = 'rejected' then 1 else 0 end)`,
      totalFees: sql<number>`sum(case when status = 'listed' then CAST(listingFee as DECIMAL) else 0 end)`,
    }).from(projects),
    db.select({
      total: sql<number>`count(*)`,
      sent: sql<number>`sum(case when direction = 'outbound' then 1 else 0 end)`,
      received: sql<number>`sum(case when direction = 'inbound' then 1 else 0 end)`,
      telegram: sql<number>`sum(case when channel = 'telegram' then 1 else 0 end)`,
      twitter: sql<number>`sum(case when channel = 'twitter' then 1 else 0 end)`,
      email: sql<number>`sum(case when channel = 'email' then 1 else 0 end)`,
      discord: sql<number>`sum(case when channel = 'discord' then 1 else 0 end)`,
    }).from(messages),
  ]);
  return { projects: projectStats[0], messages: messageStats[0] };
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function getSetting(userId: number, key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
    .limit(1);
  return result[0]?.value ?? null;
}

export async function setSetting(userId: number, key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(settings)
    .values({ userId, key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

export async function getSettings(userId: number): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(settings).where(eq(settings.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}
