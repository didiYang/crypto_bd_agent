/**
 * Project Discovery Service
 * Fetches new crypto projects from CoinMarketCap and CoinGecko (free tier)
 *
 * CoinGecko Free API Strategy:
 *   - /coins/markets (sorted by market_cap_asc to surface newer/smaller coins)
 *   - Use ath_date as a proxy for "listing date" — new coins typically hit ATH soon after listing
 *   - Scan multiple pages to maximize coverage
 *   - Also fetch coin detail for contact links (Twitter, Telegram, Discord, website)
 */

import axios from "axios";
import { createProject, getProjectBySourceId, updateAnalytics, getOrCreateAnalytics } from "./db";

// Meme-related keywords for classification
const MEME_KEYWORDS = [
  "meme", "doge", "shib", "pepe", "floki", "inu", "cat", "dog", "frog",
  "moon", "elon", "safe", "baby", "mini", "chad", "wojak", "bonk",
  "wif", "popcat", "neiro", "mog", "brett", "toshi", "turbo", "gib",
  "pnut", "goat", "act", "fwog", "retardio", "sigma", "skibidi",
];

const MEME_CATEGORIES = ["memes", "meme-token", "dog-themed-coins", "cat-themed-coins", "meme-coins"];

function isMemeProject(name: string, symbol: string, category?: string, tags?: string[]): boolean {
  const lowerName = name.toLowerCase();
  const lowerSymbol = symbol.toLowerCase();
  const lowerCategory = (category || "").toLowerCase();
  const lowerTags = (tags || []).map((t) => t.toLowerCase());

  if (MEME_CATEGORIES.some((c) => lowerCategory.includes(c))) return true;
  if (MEME_KEYWORDS.some((k) => lowerName.includes(k) || lowerSymbol.includes(k))) return true;
  if (MEME_KEYWORDS.some((k) => lowerTags.some((t) => t.includes(k)))) return true;
  return false;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type DiscoveredProject = {
  id: number;
  name: string;
  symbol: string;
  isMeme: boolean;
  logoUrl: string | null;
  twitterUrl: string | null;
  telegramUrl: string | null;
  discordUrl: string | null;
  officialEmail: string | null;
  website: string | null;
  marketCap: string | null;
  source: string;
  category: string | null;
};

// ─── CoinGecko Discovery (Free API) ──────────────────────────────────────────
export async function discoverFromCoinGecko(limit = 50, daysBack = 1): Promise<DiscoveredProject[]> {
  const newProjects: DiscoveredProject[] = [];
  const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  // Scan more pages for longer time windows
  const pagesToScan = Math.min(Math.ceil(daysBack * 2), 8);
  const perPage = 250;

  console.log(`[CoinGecko] Scanning ${pagesToScan} pages for projects in last ${daysBack} day(s)...`);

  for (let page = 1; page <= pagesToScan; page++) {
    try {
      // Use market_cap_asc to surface newer/smaller coins first
      const response = await axios.get("https://api.coingecko.com/api/v3/coins/markets", {
        timeout: 15000,
        headers: { "Accept": "application/json" },
        params: {
          vs_currency: "usd",
          order: "market_cap_asc",
          per_page: perPage,
          page,
          sparkline: false,
        },
      });

      const coins: any[] = Array.isArray(response.data) ? response.data : [];
      if (coins.length === 0) {
        console.warn(`[CoinGecko] Page ${page}: empty or rate-limited response, stopping`);
        break;
      }
      console.log(`[CoinGecko] Page ${page}: got ${coins.length} coins`);

      for (const coin of coins) {
        // Use ath_date as listing date proxy — new coins hit ATH shortly after listing
        const athDate = coin.ath_date;
        if (!athDate) continue;

        const athTime = new Date(athDate).getTime();
        // Only include coins whose ATH is within the requested time window
        if (athTime < cutoffTime) continue;

        // Skip if already in DB
        const existing = await getProjectBySourceId(coin.id, "coingecko");
        if (existing) continue;

        // Fetch detailed info for contact links
        let detail: any = null;
        try {
          const detailRes = await axios.get(`https://api.coingecko.com/api/v3/coins/${coin.id}`, {
            timeout: 10000,
            params: {
              localization: false,
              tickers: false,
              market_data: false,
              community_data: false,
              developer_data: false,
            },
          });
          detail = detailRes.data;
          // Rate limit: CoinGecko free tier allows ~30 req/min
          await new Promise((r) => setTimeout(r, 2100));
        } catch (err: any) {
          console.warn(`[CoinGecko] Detail fetch failed for ${coin.id}: ${err.message}`);
          // Still save with basic info even without detail
        }

        const categories: string[] = detail?.categories || [];
        const isMeme = isMemeProject(
          coin.name,
          coin.symbol,
          categories.join(","),
          categories
        );

        const twitterHandle = detail?.links?.twitter_screen_name || null;
        const telegramId = detail?.links?.telegram_channel_identifier || null;
        const discordUrl = detail?.links?.chat_url?.find((u: string) => u?.includes("discord")) || null;
        const homepage = detail?.links?.homepage?.[0] || null;

        try {
          const saved = await createProject({
            name: coin.name,
            symbol: coin.symbol?.toUpperCase(),
            slug: coin.id,
            description: detail?.description?.en?.slice(0, 1000) || null,
            logoUrl: coin.image || null,
            source: "coingecko",
            sourceId: coin.id,
            isMeme,
            category: categories[0] || null,
            website: homepage,
            twitterHandle,
            twitterUrl: twitterHandle ? `https://twitter.com/${twitterHandle}` : null,
            telegramUrl: telegramId ? `https://t.me/${telegramId}` : null,
            discordUrl: discordUrl || null,
            marketCap: coin.market_cap?.toString() || null,
            price: coin.current_price?.toString() || null,
            volume24h: coin.total_volume?.toString() || null,
            status: "discovered",
            priority: isMeme ? "high" : "medium",
            listedOnSourceAt: athDate ? new Date(athDate) : new Date(),
          });

          newProjects.push({
            id: saved.id,
            name: saved.name,
            symbol: saved.symbol,
            isMeme: saved.isMeme,
            logoUrl: saved.logoUrl ?? null,
            twitterUrl: saved.twitterUrl ?? null,
            telegramUrl: saved.telegramUrl ?? null,
            discordUrl: saved.discordUrl ?? null,
            officialEmail: saved.officialEmail ?? null,
            website: saved.website ?? null,
            marketCap: saved.marketCap ?? null,
            source: saved.source,
            category: saved.category ?? null,
          });

          console.log(`[CoinGecko] Saved: ${coin.name} (${coin.symbol}) isMeme=${isMeme} ath=${athDate}`);
        } catch (err: any) {
          console.warn(`[CoinGecko] Failed to save ${coin.id}: ${err.message}`);
        }

        // Stop if we've hit the limit
        if (newProjects.length >= limit) break;
      }

      if (newProjects.length >= limit) break;

      // Small pause between pages
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err: any) {
      console.error(`[CoinGecko] Page ${page} failed: ${err.message}`);
      break;
    }
  }

  // Update analytics
  if (newProjects.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const row = await getOrCreateAnalytics(today);
    await updateAnalytics(today, {
      projectsDiscovered: (row.projectsDiscovered || 0) + newProjects.length,
    });
  }

  console.log(`[CoinGecko] Total discovered: ${newProjects.length} new projects`);
  return newProjects;
}

// ─── CoinMarketCap Discovery ──────────────────────────────────────────────────
export async function discoverFromCoinMarketCap(apiKey?: string, limit = 50, daysBack = 1): Promise<DiscoveredProject[]> {
  if (!apiKey) {
    console.warn("[CMC] No API key provided, skipping CMC discovery");
    return [];
  }

  try {
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const response = await axios.get(
      "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest",
      {
        timeout: 15000,
        headers: { "X-CMC_PRO_API_KEY": apiKey },
        params: {
          limit: Math.min(limit * daysBack, 200),
          sort: "date_added",
          sort_dir: "desc",
          convert: "USD",
        },
      }
    );

    const coins = response.data?.data || [];
    const newProjects: DiscoveredProject[] = [];

    for (const coin of coins) {
      try {
        const existing = await getProjectBySourceId(String(coin.id), "coinmarketcap");
        if (existing) continue;

        const tags = coin.tags || [];
        const isMeme = isMemeProject(coin.name, coin.symbol, coin.category, tags);

        // Time filter: skip coins added before the cutoff window
        if (coin.date_added && new Date(coin.date_added).getTime() < cutoffTime) {
          continue;
        }

        const saved = await createProject({
          name: coin.name,
          symbol: coin.symbol,
          slug: coin.slug,
          source: "coinmarketcap",
          sourceId: String(coin.id),
          isMeme,
          category: coin.category || null,
          marketCap: coin.quote?.USD?.market_cap?.toString() || null,
          price: coin.quote?.USD?.price?.toString() || null,
          volume24h: coin.quote?.USD?.volume_24h?.toString() || null,
          rank: coin.cmc_rank || null,
          status: "discovered",
          priority: isMeme ? "high" : "medium",
          listedOnSourceAt: coin.date_added ? new Date(coin.date_added) : new Date(),
        });

        newProjects.push({
          id: saved.id,
          name: saved.name,
          symbol: saved.symbol,
          isMeme: saved.isMeme,
          logoUrl: saved.logoUrl ?? null,
          twitterUrl: saved.twitterUrl ?? null,
          telegramUrl: saved.telegramUrl ?? null,
          discordUrl: saved.discordUrl ?? null,
          officialEmail: saved.officialEmail ?? null,
          website: saved.website ?? null,
          marketCap: saved.marketCap ?? null,
          source: saved.source,
          category: saved.category ?? null,
        });
      } catch (err: any) {
        console.warn(`[CMC] Failed to save coin ${coin.id}:`, err.message);
      }
    }

    if (newProjects.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const row = await getOrCreateAnalytics(today);
      await updateAnalytics(today, {
        projectsDiscovered: (row.projectsDiscovered || 0) + newProjects.length,
      });
    }

    console.log(`[CMC] Discovered ${newProjects.length} new projects`);
    return newProjects;
  } catch (err: any) {
    console.error("[CMC] Discovery failed:", err.message);
    return [];
  }
}

// ─── Contact Info Enrichment ──────────────────────────────────────────────────
export async function enrichProjectContacts(projectId: number, website?: string): Promise<{
  email?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}> {
  const contacts: Record<string, string> = {};

  if (!website) return contacts;

  try {
    const response = await axios.get(website, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CryptoBDBot/1.0)" },
    });
    const html: string = response.data || "";

    // Extract email
    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatch) {
      const filtered = emailMatch.filter(
        (e) => !e.includes("example.com") && !e.includes("sentry") && !e.includes("noreply")
      );
      if (filtered[0]) contacts.email = filtered[0];
    }

    // Extract Twitter
    const twitterMatch = html.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,50})/);
    if (twitterMatch?.[1] && !["home", "search", "explore", "i"].includes(twitterMatch[1])) {
      contacts.twitter = twitterMatch[1];
    }

    // Extract Telegram
    const tgMatch = html.match(/t\.me\/([a-zA-Z0-9_]{5,50})/);
    if (tgMatch?.[1]) contacts.telegram = `https://t.me/${tgMatch[1]}`;

    // Extract Discord
    const discordMatch = html.match(/discord\.gg\/([a-zA-Z0-9_-]{6,20})/);
    if (discordMatch?.[1]) contacts.discord = `https://discord.gg/${discordMatch[1]}`;
  } catch (err: any) {
    console.warn(`[Enrich] Failed to fetch ${website}:`, err.message);
  }

  return contacts;
}

// ─── Template Rendering ───────────────────────────────────────────────────────
export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
