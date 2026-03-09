/**
 * Project Discovery Service
 * Fetches new crypto projects from CoinMarketCap and CoinGecko
 * Identifies meme coins and extracts contact information
 */

import axios from "axios";
import { createProject, getProjectBySourceId, updateAnalytics, getOrCreateAnalytics } from "./db";

// Meme-related keywords for classification
const MEME_KEYWORDS = [
  "meme", "doge", "shib", "pepe", "floki", "inu", "cat", "dog", "frog",
  "moon", "elon", "safe", "baby", "mini", "chad", "wojak", "bonk",
  "wif", "popcat", "neiro", "mog", "brett", "toshi", "turbo",
];

const MEME_CATEGORIES = ["memes", "meme-token", "dog-themed-coins", "cat-themed-coins"];

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

// ─── CoinGecko Discovery ──────────────────────────────────────────────────────
export async function discoverFromCoinGecko(limit = 50, daysBack = 1): Promise<number> {
  try {
    // Get recently added coins
    const response = await axios.get("https://api.coingecko.com/api/v3/coins/list/new", {
      timeout: 15000,
      headers: { "Accept": "application/json" },
    });

    // Filter by time window: daysBack controls how far back we look
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    // CoinGecko /coins/list/new returns coins sorted by activation time desc
    // We take up to `limit` but will also apply time-based filtering on detail fetch
    const coins = response.data?.slice(0, Math.min(limit * daysBack, 200)) || [];
    let newCount = 0;

    for (const coin of coins) {
      try {
        const existing = await getProjectBySourceId(coin.id, "coingecko");
        if (existing) continue;

        // Fetch detailed info
        const detail = await axios.get(`https://api.coingecko.com/api/v3/coins/${coin.id}`, {
          timeout: 10000,
          params: {
            localization: false,
            tickers: false,
            market_data: true,
            community_data: false,
            developer_data: false,
          },
        });

        const d = detail.data;
        const categories = d.categories || [];
        const isMeme = isMemeProject(d.name, d.symbol, categories.join(","), categories);

        // Time filter: skip coins added before the cutoff window
        const activatedAt = d.genesis_date
          ? new Date(d.genesis_date).getTime()
          : (d.market_data?.atl_date?.usd ? new Date(d.market_data.atl_date.usd).getTime() : Date.now());
        // Use market_data.last_updated as a proxy for listing time if genesis_date not available
        const listingTime = d.market_data?.last_updated
          ? new Date(d.market_data.last_updated).getTime()
          : Date.now();
        // Only skip if we have a reliable date AND it's clearly outside the window
        // (genesis_date is often null for new coins, so we don't skip when date is unknown)
        if (d.genesis_date && new Date(d.genesis_date).getTime() < cutoffTime) {
          continue;
        }

        await createProject({
          name: d.name,
          symbol: d.symbol?.toUpperCase(),
          slug: d.id,
          description: d.description?.en?.slice(0, 1000),
          logoUrl: d.image?.large,
          source: "coingecko",
          sourceId: d.id,
          isMeme,
          category: categories[0] || null,
          website: d.links?.homepage?.[0] || null,
          twitterHandle: d.links?.twitter_screen_name || null,
          twitterUrl: d.links?.twitter_screen_name
            ? `https://twitter.com/${d.links.twitter_screen_name}`
            : null,
          telegramUrl: d.links?.telegram_channel_identifier
            ? `https://t.me/${d.links.telegram_channel_identifier}`
            : null,
          discordUrl: d.links?.chat_url?.find((u: string) => u.includes("discord")) || null,
          marketCap: d.market_data?.market_cap?.usd?.toString() || null,
          price: d.market_data?.current_price?.usd?.toString() || null,
          volume24h: d.market_data?.total_volume?.usd?.toString() || null,
          chain: d.asset_platform_id || null,
          contractAddress: d.contract_address || null,
          status: "discovered",
          priority: isMeme ? "high" : "medium",
          listedOnSourceAt: new Date(),
        });

        newCount++;
        // Rate limit: 30 req/min for free tier
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err: any) {
        console.warn(`[CoinGecko] Failed to fetch details for ${coin.id}:`, err.message);
      }
    }

    // Update analytics
    if (newCount > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const row = await getOrCreateAnalytics(today);
      await updateAnalytics(today, {
        projectsDiscovered: (row.projectsDiscovered || 0) + newCount,
      });
    }

    console.log(`[CoinGecko] Discovered ${newCount} new projects`);
    return newCount;
  } catch (err: any) {
    console.error("[CoinGecko] Discovery failed:", err.message);
    return 0;
  }
}

// ─── CoinMarketCap Discovery ──────────────────────────────────────────────────
export async function discoverFromCoinMarketCap(apiKey?: string, limit = 50, daysBack = 1): Promise<number> {
  if (!apiKey) {
    console.warn("[CMC] No API key provided, skipping CMC discovery");
    return 0;
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
    let newCount = 0;

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

        await createProject({
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

        newCount++;
      } catch (err: any) {
        console.warn(`[CMC] Failed to save coin ${coin.id}:`, err.message);
      }
    }

    if (newCount > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const row = await getOrCreateAnalytics(today);
      await updateAnalytics(today, {
        projectsDiscovered: (row.projectsDiscovered || 0) + newCount,
      });
    }

    console.log(`[CMC] Discovered ${newCount} new projects`);
    return newCount;
  } catch (err: any) {
    console.error("[CMC] Discovery failed:", err.message);
    return 0;
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
