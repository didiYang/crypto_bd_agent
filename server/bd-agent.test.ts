import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  listProjects: vi.fn().mockResolvedValue([]),
  getProjectById: vi.fn(),
  createProject: vi.fn().mockResolvedValue({ id: 1, name: "TestMeme", symbol: "TMEME", status: "discovered" }),
  updateProject: vi.fn().mockResolvedValue(undefined),
  listMessages: vi.fn().mockResolvedValue([]),
  createMessage: vi.fn().mockResolvedValue({ id: 1, bodyEn: "Hello", direction: "outbound", status: "sent" }),
  updateMessage: vi.fn().mockResolvedValue(undefined),
  listTemplates: vi.fn().mockResolvedValue([]),
  getTemplateById: vi.fn(),
  createTemplate: vi.fn().mockResolvedValue({ id: 1, name: "Test Template" }),
  updateTemplate: vi.fn().mockResolvedValue(undefined),
  deleteTemplate: vi.fn().mockResolvedValue(undefined),
  listAccounts: vi.fn().mockResolvedValue([]),
  getAccountById: vi.fn(),
  createAccount: vi.fn().mockResolvedValue({ id: 1, platform: "telegram", username: "testbot" }),
  updateAccount: vi.fn().mockResolvedValue(undefined),
  deleteAccount: vi.fn().mockResolvedValue(undefined),
  getAvailableAccount: vi.fn().mockResolvedValue(null),
  getDefaultTemplate: vi.fn().mockResolvedValue(null),
  getProjectsNeedingFollowUp: vi.fn().mockResolvedValue([]),
  getAnalyticsSummary: vi.fn().mockResolvedValue({
    projects: { total: 5, contacted: 3, replied: 2, listed: 1, rejected: 0, totalFees: 5000 },
    messages: { total: 10, sent: 8, received: 2, telegram: 5, twitter: 2, email: 1, discord: 0 },
  }),
  getAnalyticsRange: vi.fn().mockResolvedValue([]),
  getOrCreateAnalytics: vi.fn().mockResolvedValue({ date: "2026-03-09", projectsContacted: 0 }),
  updateAnalytics: vi.fn().mockResolvedValue(undefined),
  resetDailyCounts: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({ telegramBotToken: null, telegramChatId: null }),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./discovery", () => ({
  discoverFromCoinGecko: vi.fn().mockResolvedValue([]),
  discoverFromCoinMarketCap: vi.fn().mockResolvedValue([]),
  enrichProjectContacts: vi.fn().mockResolvedValue({ twitterUrl: null, telegramUrl: null }),
  renderTemplate: vi.fn().mockImplementation((tpl: string, vars: Record<string, string>) => {
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`);
  }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          intent: "interested",
          sentiment: "positive",
          suggestion: "Follow up with pricing details.",
          suggestionCn: "跟进报价细节。",
          reasoning: "The team expressed clear interest.",
        }),
      },
    }],
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ─── Test context factory ─────────────────────────────────────────────────────
function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-001",
      email: "bd@exchange.com",
      name: "BD Manager",
      loginMethod: "manus",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Test Suites ──────────────────────────────────────────────────────────────
describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("projects", () => {
  it("lists projects (empty)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.list({ limit: 20, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("creates a new project", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.create({
      name: "TestMeme",
      symbol: "TMEME",
      isMeme: true,
      source: "coingecko",
    });
    expect(result.id).toBe(1);
    expect(result.name).toBe("TestMeme");
    expect(result.status).toBe("discovered");
  });
});

describe("templates", () => {
  it("lists templates (empty)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a template", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.create({
      name: "First Contact",
      scenario: "first_contact" as const,
      channel: "telegram" as const,
      bodyEn: "Hi {{contactName}}, I'd like to discuss listing {{projectName}} on our exchange.",
    });
    expect(result.id).toBe(1);
    expect(result.name).toBe("Test Template");
  });
});

describe("accounts", () => {
  it("lists accounts (empty)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.accounts.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates an account", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.accounts.create({
      type: "telegram" as const,
      label: "BD Bot 1",
      handle: "@testbot",
      dailyLimit: 50,
    });
    expect(result.id).toBe(1);
    // platform field is mapped from type in the mock
    expect(result).toBeDefined();
  });
});

describe("analytics", () => {
  it("returns summary data with correct structure", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.summary();
    expect(result).not.toBeNull();
    expect(result?.projects?.total).toBe(5);
    expect(result?.projects?.listed).toBe(1);
    expect(result?.messages?.telegram).toBe(5);
  });

  it("returns range data as array", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.range({ startDate: "2026-03-01", endDate: "2026-03-09" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("llm.analyzeReply", () => {
  it("analyzes a reply and returns structured intent/sentiment", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.llm.analyzeReply({
      messageId: 1,
      replyText: "Yes, we are very interested in listing on your exchange! Please send us more details.",
      projectName: "TestMeme",
    });
    expect(result.intent).toBe("interested");
    expect(result.sentiment).toBe("positive");
    expect(typeof result.suggestion).toBe("string");
    expect(typeof result.suggestionCn).toBe("string");
  });
});

describe("settings", () => {
  it("returns settings object", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.get();
    expect(result).toBeDefined();
  });

  it("updates settings without error", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.update({
      followUpDays: 2,
      autoFollowUp: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("followUp.runAutoFollowUp", () => {
  it("runs auto follow-up and returns processed count", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.followUp.runAutoFollowUp();
    expect(typeof result.processed).toBe("number");
    expect(Array.isArray(result.results)).toBe(true);
  });
});
