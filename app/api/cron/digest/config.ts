// ─── EDIT THIS FILE TO MAKE THE DIGEST YOURS ─────────────────────────────────

/**
 * RSS feeds the digest pulls from each morning.
 * Add or remove freely. Dead feeds are silently skipped.
 */
export const RSS_FEEDS: Array<{ name: string; url: string }> = [
  { name: "Anthropic", url: "https://www.anthropic.com/news/rss.xml" },
  { name: "OpenAI", url: "https://openai.com/blog/rss.xml" },
  { name: "Google AI", url: "https://blog.google/technology/ai/rss/" },
  { name: "DeepMind", url: "https://deepmind.google/blog/rss.xml" },
  { name: "Mistral", url: "https://mistral.ai/news/rss.xml" },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
  { name: "Replicate", url: "https://replicate.com/blog/rss" },
  { name: "Together", url: "https://www.together.ai/blog/rss.xml" },
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
  { name: "Sebastian Raschka", url: "https://magazine.sebastianraschka.com/feed" },
  { name: "Latent Space", url: "https://www.latent.space/feed" },
  { name: "Import AI", url: "https://importai.substack.com/feed" },
  { name: "The Batch", url: "https://www.deeplearning.ai/the-batch/feed/" },
  { name: "Ben's Bites", url: "https://bensbites.beehiiv.com/feed" },
  { name: "Vercel Changelog", url: "https://vercel.com/atom" },
];

/**
 * Topic gate. An item must match ONE of these to enter the digest at all.
 * Loosen this to widen scope; tighten it to focus.
 */
export const TOPIC_FILTER =
  /\b(AI|LLM|Claude|GPT|Anthropic|OpenAI|Gemini|agent|model|RAG|MCP|inference|fine-tun|eval|embedding|transformer|diffusion|reasoning)\b/i;

/**
 * Personal interest weights. Items mentioning these patterns get ranked higher.
 * The Claude prompt also reads INTEREST_PROFILE below — keep them aligned.
 */
export const INTEREST_BOOSTS: Array<{ pattern: RegExp; boost: number }> = [
  { pattern: /\b(MCP|model context protocol)\b/i, boost: 80 },
  { pattern: /\b(Claude|Anthropic|sonnet|opus|haiku)\b/i, boost: 70 },
  { pattern: /\b(agent|agentic|tool[\s-]?use|tool[\s-]?call)\b/i, boost: 60 },
  { pattern: /\b(open[\s-]?source|self[\s-]?host)\b/i, boost: 30 },
  { pattern: /\b(eval|benchmark)\b/i, boost: 20 },
];

/**
 * Plain-English description of who YOU are. Claude reads this to decide which
 * items to surface and how to write each "why you should care" hook.
 *
 * Be specific. The more concrete this is, the better the curation.
 */
export const INTEREST_PROFILE = `
You are curating a morning AI digest for a developer who:
- Builds with LLMs, mostly the Claude API and Anthropic ecosystem
- Cares about: MCP, agent frameworks, open-source AI tooling, eval methodology
- Actively skips: hype cycles, marketing posts, generic "AI is changing everything" takes, enterprise sales content
`.trim();

/**
 * GitHub topics to watch for trending repos. The cron searches for repos
 * created in the last 7 days with >50 stars matching ANY of these topics.
 */
export const GITHUB_TOPICS = ["ai", "llm", "agent", "mcp", "rag", "anthropic"];

/**
 * Visual config for the email.
 */
export const EMAIL_TITLE = "AI Digest";
export const EMAIL_FROM_NAME = "AI Digest";
