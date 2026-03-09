import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import {
  createAccount,
  createMessage,
  createProject,
  createTemplate,
  deleteAccount,
  deleteTemplate,
  getAccountById,
  getAnalyticsRange,
  getAnalyticsSummary,
  getAvailableAccount,
  getDefaultTemplate,
  getOrCreateAnalytics,
  getProjectById,
  getProjectsNeedingFollowUp,
  getSettings,
  getSetting,
  getTemplateById,
  listAccounts,
  listMessages,
  listProjects,
  listTemplates,
  resetDailyCounts,
  setSetting,
  updateAccount,
  updateAnalytics,
  updateMessage,
  updateProject,
  updateTemplate,
} from "./db";
import { discoverFromCoinGecko, discoverFromCoinMarketCap, enrichProjectContacts, renderTemplate } from "./discovery";

// ─── Seed default templates ───────────────────────────────────────────────────
async function seedDefaultTemplates(userId: number) {
  const existing = await listTemplates(userId);
  if (existing.length > 0) return;

  const defaults = [
    {
      name: "First Contact - Listing Invitation",
      scenario: "first_contact" as const,
      channel: "all" as const,
      subject: "Listing Opportunity on MGBX Exchange - {{projectName}} ({{symbol}})",
      bodyEn: `Hi {{contactName}},

I hope this message finds you well! My name is [Your Name] from MGBX Exchange.

I came across {{projectName}} ({{symbol}}) and I'm genuinely impressed by your project's vision and community growth. We believe {{projectName}} has strong potential and would be a great fit for our platform.

MGBX Exchange offers:
• Competitive listing fees with flexible payment options
• Access to our growing user base of active traders
• 24/7 dedicated support and marketing collaboration
• Fast listing process (typically 3-5 business days)

I'd love to discuss a potential listing partnership. Would you be available for a quick call or chat this week?

Looking forward to hearing from you!

Best regards,
[Your Name]
MGBX Exchange | Business Development
Telegram: @mgbx_bd | Email: bd@mgbx.com`,
      bodyCn: `您好 {{contactName}}，

希望您一切都好！我是MGBX交易所的[您的名字]。

我注意到了{{projectName}} ({{symbol}})，对您项目的愿景和社区增长印象深刻。我们认为{{projectName}}具有强大的潜力，非常适合在我们的平台上上线。

MGBX交易所提供：
• 具有竞争力的上币费用，灵活的支付方式
• 接触我们不断增长的活跃交易用户群
• 全天候专属支持和营销合作
• 快速上币流程（通常3-5个工作日）

我很乐意讨论潜在的上币合作。您这周是否有时间进行简短的通话或聊天？

期待您的回复！

此致
[您的名字]
MGBX交易所 | 商务拓展`,
      isDefault: true,
    },
    {
      name: "Follow-up - No Response",
      scenario: "follow_up" as const,
      channel: "all" as const,
      subject: "Following Up - Listing Opportunity for {{projectName}}",
      bodyEn: `Hi {{contactName}},

I wanted to follow up on my previous message regarding a listing opportunity for {{projectName}} ({{symbol}}) on MGBX Exchange.

I understand you're busy, so I'll keep this brief — we're currently offering special listing terms for promising projects like yours, and I wouldn't want you to miss this window.

Our current offer includes:
• Reduced listing fee for early applicants
• Priority marketing support during launch
• Dedicated trading pair with high liquidity

If you're interested or have any questions, please don't hesitate to reach out. I'm happy to schedule a call at your convenience.

Best regards,
[Your Name]
MGBX Exchange | Business Development`,
      bodyCn: `您好 {{contactName}}，

我想跟进一下之前关于{{projectName}} ({{symbol}})在MGBX交易所上币机会的消息。

我理解您很忙，所以我长话短说——我们目前为像您这样有前途的项目提供特别上币条款，我不希望您错过这个机会。

我们当前的优惠包括：
• 早期申请者的优惠上币费用
• 上线期间优先营销支持
• 专属高流动性交易对

如果您有兴趣或有任何问题，请随时联系我。我很乐意按您方便的时间安排通话。

此致
[您的名字]
MGBX交易所 | 商务拓展`,
      isDefault: true,
    },
    {
      name: "Quote - Listing Fee Proposal",
      scenario: "quote" as const,
      channel: "email" as const,
      subject: "Formal Listing Proposal for {{projectName}} - MGBX Exchange",
      bodyEn: `Dear {{contactName}},

Thank you for your interest in listing {{projectName}} ({{symbol}}) on MGBX Exchange!

Following our conversation, here is our formal listing proposal:

LISTING PACKAGE:
• Listing Fee: [Fee Amount] USDT
• Trading Pairs: {{symbol}}/USDT, {{symbol}}/BTC (optional)
• Listing Timeline: 3-5 business days after fee payment
• Marketing Support: Social media announcements, AMA session, newsletter feature

WHAT WE OFFER:
• Top-tier security and compliance standards
• 24/7 customer support in multiple languages
• Advanced trading features and API access
• Regular market-making support

To proceed, please confirm your interest and we'll send the official listing agreement.

Best regards,
[Your Name]
MGBX Exchange | Business Development`,
      bodyCn: `亲爱的 {{contactName}}，

感谢您对在MGBX交易所上线{{projectName}} ({{symbol}})的兴趣！

根据我们的对话，以下是我们的正式上币提案：

上币套餐：
• 上币费用：[费用金额] USDT
• 交易对：{{symbol}}/USDT，{{symbol}}/BTC（可选）
• 上币时间：付款后3-5个工作日
• 营销支持：社交媒体公告、AMA活动、通讯特刊

我们提供：
• 顶级安全和合规标准
• 多语言24/7客户支持
• 高级交易功能和API访问
• 定期做市商支持

如需继续，请确认您的兴趣，我们将发送正式上币协议。

此致
[您的名字]
MGBX交易所 | 商务拓展`,
      isDefault: true,
    },
  ];

  for (const t of defaults) {
    await createTemplate({ ...t, userId });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Projects ──────────────────────────────────────────────────────────────
  projects: router({
    list: protectedProcedure
      .input(
        z.object({
          status: z.string().optional(),
          isMeme: z.boolean().optional(),
          source: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
        })
      )
      .query(({ input }) => listProjects(input)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const p = await getProjectById(input.id);
        if (!p) throw new TRPCError({ code: "NOT_FOUND" });
        return p;
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          symbol: z.string().min(1),
          description: z.string().optional(),
          website: z.string().optional(),
          twitterHandle: z.string().optional(),
          twitterUrl: z.string().optional(),
          telegramUrl: z.string().optional(),
          discordUrl: z.string().optional(),
          officialEmail: z.string().optional(),
          contactPersonName: z.string().optional(),
          contactPersonTg: z.string().optional(),
          isMeme: z.boolean().default(false),
          category: z.string().optional(),
          chain: z.string().optional(),
          notes: z.string().optional(),
          priority: z.enum(["high", "medium", "low"]).default("medium"),
        })
      )
      .mutation(({ input }) => createProject({ ...input, source: "manual" })),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["discovered", "contacted", "replied", "negotiating", "listed", "rejected", "blacklisted"]).optional(),
          notes: z.string().optional(),
          contactPersonName: z.string().optional(),
          contactPersonTg: z.string().optional(),
          officialEmail: z.string().optional(),
          twitterHandle: z.string().optional(),
          twitterUrl: z.string().optional(),
          telegramUrl: z.string().optional(),
          discordUrl: z.string().optional(),
          listingFee: z.string().optional(),
          listingFeeCurrency: z.string().optional(),
          priority: z.enum(["high", "medium", "low"]).optional(),
          isMeme: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updated = await updateProject(id, data);
        // Update analytics if status changed to listed
        if (data.status === "listed") {
          const today = new Date().toISOString().slice(0, 10);
          const row = await getOrCreateAnalytics(today);
          await updateAnalytics(today, {
            projectsListed: (row.projectsListed || 0) + 1,
          });
        }
        return updated;
      }),

    discover: protectedProcedure
      .input(z.object({
        source: z.enum(["coingecko", "coinmarketcap", "all"]).default("coingecko"),
        daysBack: z.number().min(1).max(7).default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const cmcKey = await getSetting(userId, "cmc_api_key");
        const { daysBack } = input;
        // Scale limit with daysBack: 7 days needs more slots
        const limit = Math.min(30 * daysBack, 200);
        const geckoResult = await discoverFromCoinGecko(limit, daysBack);
        const cmcResult = cmcKey
          ? await discoverFromCoinMarketCap(cmcKey, limit, daysBack)
          : { newProjects: [], updatedCount: 0 };
        const newProjects = [...geckoResult.newProjects, ...cmcResult.newProjects];
        const updatedCount = geckoResult.updatedCount + cmcResult.updatedCount;
        return { discovered: newProjects.length, updatedCount, daysBack, projects: newProjects };
      }),

    enrichContacts: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const project = await getProjectById(input.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        const contacts = await enrichProjectContacts(input.id, project.website ?? undefined);
        if (Object.keys(contacts).length > 0) {
          await updateProject(input.id, {
            officialEmail: contacts.email || project.officialEmail || undefined,
            twitterHandle: contacts.twitter || project.twitterHandle || undefined,
            twitterUrl: contacts.twitter ? `https://twitter.com/${contacts.twitter}` : project.twitterUrl || undefined,
            telegramUrl: contacts.telegram || project.telegramUrl || undefined,
            discordUrl: contacts.discord || project.discordUrl || undefined,
          });
        }
        return contacts;
      }),

    needsFollowUp: protectedProcedure.query(() => getProjectsNeedingFollowUp()),

    stats: protectedProcedure.query(() => getAnalyticsSummary()),
  }),

  // ─── Accounts ──────────────────────────────────────────────────────────────
  accounts: router({
    list: protectedProcedure.query(({ ctx }) => listAccounts(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          type: z.enum(["twitter", "telegram", "email"]),
          label: z.string().min(1),
          handle: z.string().min(1),
          dailyLimit: z.number().min(1).max(500).default(50),
          notes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => createAccount({ ...input, userId: ctx.user.id })),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          label: z.string().optional(),
          handle: z.string().optional(),
          isActive: z.boolean().optional(),
          dailyLimit: z.number().min(1).max(500).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateAccount(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteAccount(input.id)),

    resetDailyCounts: protectedProcedure.mutation(() => resetDailyCounts()),
  }),

  // ─── Templates ─────────────────────────────────────────────────────────────
  templates: router({
    list: protectedProcedure
      .input(z.object({ scenario: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        await seedDefaultTemplates(ctx.user.id);
        return listTemplates(ctx.user.id, input.scenario);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const t = await getTemplateById(input.id);
        if (!t) throw new TRPCError({ code: "NOT_FOUND" });
        return t;
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          scenario: z.enum(["first_contact", "follow_up", "quote", "negotiation", "closing"]),
          channel: z.enum(["twitter", "telegram", "email", "all"]).default("all"),
          subject: z.string().optional(),
          bodyEn: z.string().min(1),
          bodyCn: z.string().optional(),
          isDefault: z.boolean().default(false),
        })
      )
      .mutation(({ ctx, input }) => createTemplate({ ...input, userId: ctx.user.id })),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          scenario: z.enum(["first_contact", "follow_up", "quote", "negotiation", "closing"]).optional(),
          channel: z.enum(["twitter", "telegram", "email", "all"]).optional(),
          subject: z.string().optional(),
          bodyEn: z.string().optional(),
          bodyCn: z.string().optional(),
          isDefault: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateTemplate(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteTemplate(input.id)),

    preview: protectedProcedure
      .input(
        z.object({
          templateId: z.number(),
          projectId: z.number(),
        })
      )
      .query(async ({ input }) => {
        const [template, project] = await Promise.all([
          getTemplateById(input.templateId),
          getProjectById(input.projectId),
        ]);
        if (!template || !project) throw new TRPCError({ code: "NOT_FOUND" });
        const vars = {
          projectName: project.name,
          symbol: project.symbol,
          contactName: project.contactPersonName || "Team",
        };
        return {
          subject: template.subject ? renderTemplate(template.subject, vars) : undefined,
          bodyEn: renderTemplate(template.bodyEn, vars),
          bodyCn: template.bodyCn ? renderTemplate(template.bodyCn, vars) : undefined,
        };
      }),
  }),

  // ─── Messages ──────────────────────────────────────────────────────────────
  messages: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(({ input }) => listMessages(input.projectId)),

    send: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          channel: z.enum(["twitter", "telegram", "email", "discord", "manual"]),
          templateId: z.number().optional(),
          bodyEn: z.string().min(1),
          bodyCn: z.string().optional(),
          subject: z.string().optional(),
          isFollowUp: z.boolean().default(false),
          followUpNumber: z.number().default(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });

        // Get available account for this channel
        const account = input.channel !== "manual"
          ? await getAvailableAccount(input.channel as "twitter" | "telegram" | "email")
          : undefined;

        const msg = await createMessage({
          projectId: input.projectId,
          accountId: account?.id,
          templateId: input.templateId,
          direction: "outbound",
          channel: input.channel,
          subject: input.subject,
          bodyEn: input.bodyEn,
          bodyCn: input.bodyCn,
          status: "sent",
          isFollowUp: input.isFollowUp,
          followUpNumber: input.followUpNumber,
          sentAt: new Date(),
        });

        // Update project status and timestamps
        const now = new Date();
        await updateProject(input.projectId, {
          status: project.status === "discovered" ? "contacted" : project.status,
          firstContactAt: project.firstContactAt || now,
          lastContactAt: now,
        });

        // Update account daily count
        if (account) {
          await updateAccount(account.id, { sentToday: (account.sentToday || 0) + 1 });
        }

        // Update analytics
        const today = new Date().toISOString().slice(0, 10);
        const row = await getOrCreateAnalytics(today);
        await updateAnalytics(today, {
          messagesSent: (row.messagesSent || 0) + 1,
          projectsContacted: input.isFollowUp ? row.projectsContacted : (row.projectsContacted || 0) + 1,
          followUpsSent: input.isFollowUp ? (row.followUpsSent || 0) + 1 : row.followUpsSent,
        });

        // Update template usage count
        if (input.templateId) {
          const tmpl = await getTemplateById(input.templateId);
          if (tmpl) await updateTemplate(input.templateId, { usageCount: (tmpl.usageCount || 0) + 1 });
        }

        return msg;
      }),

    recordReply: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          channel: z.enum(["twitter", "telegram", "email", "discord", "manual"]),
          bodyEn: z.string().min(1),
          bodyCn: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });

        const msg = await createMessage({
          projectId: input.projectId,
          direction: "inbound",
          channel: input.channel,
          bodyEn: input.bodyEn,
          bodyCn: input.bodyCn,
          status: "replied",
          sentAt: new Date(),
        });

        // Update project status
        const now = new Date();
        await updateProject(input.projectId, {
          status: project.status === "contacted" ? "replied" : project.status,
          lastReplyAt: now,
        });

        // Update analytics
        const today = new Date().toISOString().slice(0, 10);
        const row = await getOrCreateAnalytics(today);
        await updateAnalytics(today, {
          messagesReceived: (row.messagesReceived || 0) + 1,
          projectsReplied: (row.projectsReplied || 0) + 1,
        });

        // Notify owner
        await notifyOwner({
          title: `💬 Reply from ${project.name} (${project.symbol})`,
          content: `Project ${project.name} replied via ${input.channel}:\n\n${input.bodyEn.slice(0, 300)}`,
        });

        return msg;
      }),
  }),

  // ─── Follow-up ─────────────────────────────────────────────────────────────
  followUp: router({
    pending: protectedProcedure.query(() => getProjectsNeedingFollowUp()),

    trigger: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });

        // Get default follow-up template
        const template = await getDefaultTemplate("follow_up");
        if (!template) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No follow-up template found" });

        const vars = {
          projectName: project.name,
          symbol: project.symbol,
          contactName: project.contactPersonName || "Team",
        };

        const bodyEn = renderTemplate(template.bodyEn, vars);
        const bodyCn = template.bodyCn ? renderTemplate(template.bodyCn, vars) : undefined;

        // Determine best channel
        const channel = project.telegramUrl ? "telegram" : project.officialEmail ? "email" : "manual";

        const msg = await createMessage({
          projectId: input.projectId,
          templateId: template.id,
          direction: "outbound",
          channel: channel as any,
          subject: template.subject ? renderTemplate(template.subject, vars) : undefined,
          bodyEn,
          bodyCn,
          status: "sent",
          isFollowUp: true,
          followUpNumber: 2,
          sentAt: new Date(),
        });

        await updateProject(input.projectId, { lastContactAt: new Date() });

        const today = new Date().toISOString().slice(0, 10);
        const row = await getOrCreateAnalytics(today);
        await updateAnalytics(today, {
          followUpsSent: (row.followUpsSent || 0) + 1,
        });

        return { message: msg, project };
      }),

    runAutoFollowUp: protectedProcedure.mutation(async () => {
      const projects = await getProjectsNeedingFollowUp();
      const results = [];
      for (const project of projects) {
        try {
          const template = await getDefaultTemplate("follow_up");
          if (!template) continue;
          const vars = {
            projectName: project.name,
            symbol: project.symbol,
            contactName: project.contactPersonName || "Team",
          };
          const bodyEn = renderTemplate(template.bodyEn, vars);
          const channel = project.telegramUrl ? "telegram" : project.officialEmail ? "email" : "manual";
          await createMessage({
            projectId: project.id,
            templateId: template.id,
            direction: "outbound",
            channel: channel as any,
            bodyEn,
            bodyCn: template.bodyCn ? renderTemplate(template.bodyCn, vars) : undefined,
            status: "sent",
            isFollowUp: true,
            followUpNumber: 2,
            sentAt: new Date(),
          });
          await updateProject(project.id, { lastContactAt: new Date() });
          results.push({ projectId: project.id, name: project.name, status: "sent" });
        } catch (e: any) {
          results.push({ projectId: project.id, name: project.name, status: "failed", error: e.message });
        }
      }
      return { processed: results.length, results };
    }),
  }),

  // ─── Analytics ─────────────────────────────────────────────────────────────
  analytics: router({
    summary: protectedProcedure.query(() => getAnalyticsSummary()),

    range: protectedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(({ input }) => getAnalyticsRange(input.startDate, input.endDate)),

    today: protectedProcedure.query(async () => {
      const today = new Date().toISOString().slice(0, 10);
      return getOrCreateAnalytics(today);
    }),
  }),

  // ─── LLM Analysis ──────────────────────────────────────────────────────────
  llm: router({
    analyzeReply: protectedProcedure
      .input(
        z.object({
          messageId: z.number(),
          replyText: z.string(),
          projectName: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert crypto exchange BD (Business Development) analyst. 
Analyze project team replies to listing invitations and provide:
1. Intent classification: "interested", "neutral", "rejected", "question", "negotiating"
2. Sentiment: "positive", "neutral", "negative"
3. A personalized follow-up suggestion in English (2-3 sentences, professional tone)
4. Chinese translation of the suggestion
Respond in JSON format only.`,
            },
            {
              role: "user",
              content: `Project: ${input.projectName}
Reply message: "${input.replyText}"

Analyze this reply and provide follow-up strategy.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "reply_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  intent: { type: "string", enum: ["interested", "neutral", "rejected", "question", "negotiating"] },
                  sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                  suggestion: { type: "string" },
                  suggestionCn: { type: "string" },
                  reasoning: { type: "string" },
                },
                required: ["intent", "sentiment", "suggestion", "suggestionCn", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : null;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty response" });

        const analysis = JSON.parse(content);

        // Save analysis to message
        await updateMessage(input.messageId, {
          replyIntent: analysis.intent,
          replysentiment: analysis.sentiment,
          llmSuggestion: analysis.suggestion,
          llmSuggestionCn: analysis.suggestionCn,
        });

        return analysis;
      }),

    generatePersonalized: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          scenario: z.enum(["first_contact", "follow_up", "quote", "negotiation"]),
        })
      )
      .mutation(async ({ input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert crypto exchange BD specialist writing personalized outreach messages.
Write a professional, concise English message for a ${input.scenario} scenario.
The message should feel personal, not generic. Keep it under 200 words.
Also provide a Chinese translation.
Respond in JSON format only.`,
            },
            {
              role: "user",
              content: `Project details:
- Name: ${project.name}
- Symbol: ${project.symbol}
- Category: ${project.category || "crypto"}
- Is Meme: ${project.isMeme}
- Chain: ${project.chain || "unknown"}
- Market Cap: ${project.marketCap || "unknown"}
- Description: ${project.description?.slice(0, 200) || "N/A"}

Write a ${input.scenario} message to invite this project to list on MGBX Exchange.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "personalized_message",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  subject: { type: "string" },
                  bodyEn: { type: "string" },
                  bodyCn: { type: "string" },
                },
                required: ["subject", "bodyEn", "bodyCn"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent2 = response.choices?.[0]?.message?.content;
        const content2 = typeof rawContent2 === "string" ? rawContent2 : null;
        if (!content2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return JSON.parse(content2);
      }),
  }),

  // ─── Settings ──────────────────────────────────────────────────────────────
  settings: router({
    get: protectedProcedure.query(({ ctx }) => getSettings(ctx.user.id)),

    set: protectedProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(({ ctx, input }) => setSetting(ctx.user.id, input.key, input.value)),

    setMultiple: protectedProcedure
      .input(z.record(z.string(), z.string()))
      .mutation(async ({ ctx, input }) => {
        for (const [key, value] of Object.entries(input)) {
          await setSetting(ctx.user.id, key, value);
        }
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        telegramBotToken: z.string().optional(),
        telegramChatId: z.string().optional(),
        telegramNotifyNewProject: z.boolean().optional(),
        telegramNotifyReply: z.boolean().optional(),
        telegramNotifyFollowUp: z.boolean().optional(),
        cgApiKey: z.string().optional(),
        cmcApiKey: z.string().optional(),
        followUpDays: z.number().optional(),
        autoFollowUp: z.boolean().optional(),
        autoDiscover: z.boolean().optional(),
        discoverInterval: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const entries = Object.entries(input).filter(([, v]) => v !== undefined);
        for (const [key, value] of entries) {
          await setSetting(ctx.user.id, key, String(value));
        }
        return { success: true };
      }),

    testTelegram: protectedProcedure
      .mutation(async ({ ctx }) => {
        const s = await getSettings(ctx.user.id);
        const botToken = s.telegramBotToken;
        const chatId = s.telegramChatId;
        if (!botToken || !chatId) throw new TRPCError({ code: "BAD_REQUEST", message: "Please configure Telegram Bot Token and Chat ID first" });
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: "🤖 Crypto BD Agent: Telegram notification is working! ✅\n加密BD Agent: Telegram通知已成功配置！" }),
        });
        const data = await res.json() as any;
        if (!data.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: data.description || "Telegram API error" });
        return { success: true };
      }),

    seedTemplates: protectedProcedure
      .mutation(async ({ ctx }) => {
        const defaultTemplates = [
          {
            name: "First Contact - Meme Project",
            scenario: "first_contact" as const,
            channel: "telegram" as const,
            bodyEn: `Hi {{contactName}},\n\nI came across {{projectName}} ({{symbol}}) and I'm really impressed by the community momentum you've built!\n\nI'm reaching out from MGBX Exchange — we're a fast-growing crypto exchange focused on listing high-potential projects early. We'd love to discuss a listing opportunity for {{symbol}}.\n\nWe offer:\n• Competitive listing fees\n• Strong marketing support & exposure\n• Fast listing process (3-5 days)\n• Active trading community\n\nWould you be open to a quick chat? I'd love to learn more about your roadmap and see how we can support {{projectName}}'s growth.\n\nBest regards,\nBD Team | MGBX Exchange`,
            bodyCn: `您好 {{contactName}}，\n\n我注意到了 {{projectName}} ({{symbol}})，对您建立的社区动力印象深刻！\n\n我来自MGBX交易所——我们是一个专注于早期上架高潜力项目的快速成长型加密交易所。我们很乐意讨论 {{symbol}} 的上币机会。\n\n我们提供：\n• 有竞争力的上币费用\n• 强大的营销支持和曝光\n• 快速上币流程（3-5天）\n• 活跃的交易社区\n\n您是否愿意进行简短的交流？我很想了解您的路线图，看看我们如何支持 {{projectName}} 的发展。`,
            isDefault: true,
            usageCount: 0,
          },
          {
            name: "Follow-up - No Reply",
            scenario: "follow_up" as const,
            channel: "all" as const,
            bodyEn: `Hi {{contactName}},\n\nJust following up on my previous message about listing {{projectName}} ({{symbol}}) on MGBX Exchange.\n\nI understand you're busy, but I wanted to make sure my message didn't get lost. We're currently onboarding new projects and {{symbol}} would be a great fit for our platform.\n\nIf you're interested, even a 10-minute call would be great. Or feel free to reply here with any questions.\n\nLooking forward to hearing from you!\n\nBest,\nBD Team | MGBX Exchange`,
            bodyCn: `您好 {{contactName}}，\n\n跟进一下我之前关于在MGBX交易所上架 {{projectName}} ({{symbol}}) 的消息。\n\n我理解您很忙，但我想确保我的消息没有被遗漏。我们目前正在接纳新项目，{{symbol}} 非常适合我们的平台。\n\n如果您感兴趣，即使是10分钟的通话也很好。或者随时在这里回复您的任何问题。`,
            isDefault: true,
            usageCount: 0,
          },
          {
            name: "Quote - Listing Fee",
            scenario: "quote" as const,
            channel: "all" as const,
            subject: "Listing Proposal for {{projectName}} ({{symbol}}) - MGBX Exchange",
            bodyEn: `Hi {{contactName}},\n\nThank you for your interest in listing {{projectName}} on MGBX Exchange!\n\nHere's our listing proposal:\n\n📋 LISTING PACKAGE:\n• Listing Fee: $[FEE] USDT\n• Trading Pairs: {{symbol}}/USDT, {{symbol}}/BTC\n• Listing Timeline: 3-5 business days after payment\n• Marketing Package: Social media announcement, banner ads, email newsletter\n• Market Making: Available upon request\n\n💎 WHAT YOU GET:\n• 24/7 trading access for your community\n• Real-time price tracking & charts\n• API access for trading bots\n• Dedicated BD support\n\nPlease let me know if you'd like to proceed or if you have any questions about the terms.\n\nBest regards,\nBD Team | MGBX Exchange`,
            bodyCn: `您好 {{contactName}}，\n\n感谢您对在MGBX交易所上架 {{projectName}} 的兴趣！\n\n以下是我们的上币提案：\n\n📋 上币套餐：\n• 上币费：$[FEE] USDT\n• 交易对：{{symbol}}/USDT, {{symbol}}/BTC\n• 上币时间：付款后3-5个工作日\n• 营销套餐：社交媒体公告、横幅广告、邮件通讯\n• 做市商：可根据要求提供`,
            isDefault: false,
            usageCount: 0,
          },
        ];
        const { createTemplate } = await import("./db");
        let created = 0;
        for (const t of defaultTemplates) {
          await createTemplate({ ...t, userId: ctx.user.id });
          created++;
        }
        return { created };
      }),
  }),
});

export type AppRouter = typeof appRouter;
