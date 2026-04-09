import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";
import Parser from "rss-parser";
import {
  RSS_FEEDS,
  TOPIC_FILTER,
  INTEREST_BOOSTS,
  INTEREST_PROFILE,
  GITHUB_TOPICS,
  EMAIL_TITLE,
  EMAIL_FROM_NAME,
} from "./config";

export const maxDuration = 300;

type Item = {
  source: string;
  title: string;
  url: string;
  summary?: string;
  score: number;
  publishedAt: string;
};

function applyBoosts(text: string, baseScore: number): number {
  let score = baseScore;
  for (const { pattern, boost } of INTEREST_BOOSTS) {
    if (pattern.test(text)) score += boost;
  }
  return score;
}

async function fetchHN(): Promise<Item[]> {
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  const url = `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>${since},points>40`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data: {
    hits: Array<{
      title: string;
      url: string | null;
      objectID: string;
      points: number;
      num_comments: number;
      created_at: string;
    }>;
  } = await res.json();
  return data.hits
    .filter((h) => h.title && TOPIC_FILTER.test(h.title))
    .map((h) => ({
      source: "HN",
      title: h.title,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      score: applyBoosts(h.title, h.points + h.num_comments * 2),
      publishedAt: h.created_at,
    }));
}

async function fetchRSS(): Promise<Item[]> {
  const parser = new Parser({ timeout: 15000 });
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items ?? [])
        .filter((i) => {
          const ts = i.isoDate ? new Date(i.isoDate).getTime() : 0;
          return ts > since;
        })
        .map<Item>((i) => {
          const text = `${i.title ?? ""} ${i.contentSnippet ?? ""}`;
          return {
            source: feed.name,
            title: i.title ?? "(untitled)",
            url: i.link ?? "",
            summary: (i.contentSnippet ?? "").slice(0, 400),
            score: applyBoosts(text, 100),
            publishedAt: i.isoDate ?? new Date().toISOString(),
          };
        });
    }),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function fetchGitHubTrending(): Promise<Item[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const topicQuery = GITHUB_TOPICS.map((t) => `topic:${t}`).join(" OR ");
  const q = encodeURIComponent(`created:>${since} stars:>50 (${topicQuery})`);
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=10`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (!res.ok) return [];
  const data: {
    items: Array<{ full_name: string; description: string | null; html_url: string; stargazers_count: number; created_at: string }>;
  } = await res.json();
  return data.items.map((r) => ({
    source: "GitHub",
    title: `${r.full_name} — ${r.description ?? ""}`.slice(0, 200),
    url: r.html_url,
    score: applyBoosts(`${r.full_name} ${r.description ?? ""}`, r.stargazers_count),
    publishedAt: r.created_at,
  }));
}

function dedupe(items: Item[]): Item[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = i.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function summarize(items: Item[]) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `${INTEREST_PROFILE}

From these ${items.length} items, write a punchy digest. Output ONLY a JSON object (no prose, no code fences) in this exact shape:

{
  "headline": "One-line summary of the single most important story today (max 80 chars)",
  "bullets": [
    {
      "source": "source name",
      "title": "item title",
      "url": "url",
      "hook": "one sentence on why this matters, written like a friend tipping you off"
    }
  ]
}

Rules:
- 6-9 bullets, ordered by importance
- Skip duplicates and fluff
- "hook" should be specific and concrete, not generic
- If nothing is genuinely interesting, return fewer bullets — quality over quantity

Items:
${JSON.stringify(items.slice(0, 35), null, 2)}`,
      },
    ],
  });
  const block = msg.content[0];
  const text = block.type === "text" ? block.text : "";
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as {
    headline: string;
    bullets: Array<{ source: string; title: string; url: string; hook: string }>;
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderEmail(digest: { headline: string; bullets: Array<{ source: string; title: string; url: string; hook: string }> }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const bulletsHtml = digest.bullets
    .map(
      (b) => `
    <tr>
      <td style="padding: 14px 0; border-bottom: 1px solid #e5e5e5;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 4px;">${escapeHtml(b.source)}</div>
        <a href="${escapeHtml(b.url)}" style="font-size: 16px; font-weight: 600; color: #111; text-decoration: none; line-height: 1.4;">${escapeHtml(b.title)}</a>
        <div style="font-size: 14px; color: #555; margin-top: 6px; line-height: 1.5;">${escapeHtml(b.hook)}</div>
      </td>
    </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f5f5f5; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <tr>
            <td>
              <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">${today} · ${escapeHtml(EMAIL_TITLE)}</div>
              <h1 style="font-size: 22px; line-height: 1.3; color: #111; margin: 8px 0 24px 0;">${escapeHtml(digest.headline)}</h1>
              <table width="100%" cellpadding="0" cellspacing="0">${bulletsHtml}</table>
              <div style="font-size: 11px; color: #aaa; margin-top: 24px; text-align: center;">Sourced from HN, GitHub, and ${RSS_FEEDS.length} RSS feeds</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function makeTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
  });
}

async function sendEmail(subject: string, html: string) {
  await makeTransporter().sendMail({
    from: `"${EMAIL_FROM_NAME}" <${process.env.GMAIL_USER}>`,
    to: process.env.DIGEST_TO!,
    subject,
    html,
  });
}

async function notifyError(err: unknown) {
  try {
    await makeTransporter().sendMail({
      from: `"${EMAIL_FROM_NAME}" <${process.env.GMAIL_USER}>`,
      to: process.env.DIGEST_TO!,
      subject: `⚠️ ${EMAIL_TITLE} failed — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      text: `The daily digest cron failed.\n\n${String(err)}\n\n${err instanceof Error ? err.stack : ""}`,
    });
  } catch {
    /* swallow — don't loop */
  }
}

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [hn, rss, gh] = await Promise.all([fetchHN(), fetchRSS(), fetchGitHubTrending()]);
    const all = dedupe([...hn, ...rss, ...gh])
      .sort((a, b) => b.score - a.score)
      .slice(0, 35);

    if (all.length === 0) {
      return Response.json({ ok: true, sent: false, reason: "no items" });
    }

    const digest = await summarize(all);
    const subject = `🤖 ${digest.headline.slice(0, 80)}`;
    const html = renderEmail(digest);
    await sendEmail(subject, html);

    return Response.json({ ok: true, sent: true, total: all.length, bullets: digest.bullets.length });
  } catch (err) {
    console.error(err);
    await notifyError(err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
