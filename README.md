# Daily AI Digest Kit

A cron that emails you a curated AI news digest every morning. $0/month, deploys in 5 minutes, runs on Vercel's free tier.

No n8n. No Zapier. No paid scrapers. No newsletter platform.

Just one Next.js route that pulls from Hacker News, GitHub trending, and 15 RSS feeds, ranks everything against your interests, hands the top items to Claude Haiku, and emails the result through your own Gmail.

---

## What you get each morning

A clean HTML email with:
- A one-line headline pulled from the day's biggest story
- 6–9 ranked bullets (source · title · one-sentence "why you should care" hook)
- Links straight to the source

Fully tunable: edit one config file to change feeds, keywords, what you care about, and how the email is branded.

---

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcaseymcdougal%2Fai-digest-kit&env=ANTHROPIC_API_KEY,GMAIL_USER,GMAIL_APP_PASSWORD,DIGEST_TO,CRON_SECRET&envDescription=See%20README%20for%20how%20to%20get%20each%20value&project-name=ai-digest&repository-name=ai-digest)

Click the button. Vercel will fork the repo, ask for the env vars below, and deploy. Done.

### Environment variables

| Variable | What it is | How to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key — used to summarize items | [console.anthropic.com](https://console.anthropic.com/settings/keys) → API Keys → Create. Free credits cover this easily (~$0.001/day). |
| `GMAIL_USER` | Your gmail address | The address you want the digest sent from. |
| `GMAIL_APP_PASSWORD` | 16-char app password (NOT your normal password) | [myaccount.google.com](https://myaccount.google.com/apppasswords). Requires 2-Step Verification on your account first. |
| `DIGEST_TO` | Where to send the digest | Usually the same as `GMAIL_USER`. |
| `CRON_SECRET` | Random string protecting the endpoint | Generate with `openssl rand -hex 32` or pick any long random string. |

After deploy, the cron runs automatically every day at the time set in `vercel.json` (default: `0 14 * * *` = 14:00 UTC = 9am ET).

---

## Customize

Edit [`app/api/cron/digest/config.ts`](app/api/cron/digest/config.ts):

- **`RSS_FEEDS`** — add/remove sources. Dead feeds skip silently.
- **`TOPIC_FILTER`** — regex gate. Items must match to enter the digest.
- **`INTEREST_BOOSTS`** — keyword patterns that bump an item's ranking score.
- **`INTEREST_PROFILE`** — plain-English description of who you are. Claude reads this to decide what to surface and how to write each hook. **The more specific you make this, the better the curation.**
- **`GITHUB_TOPICS`** — GitHub topic tags the cron searches for trending repos.
- **`EMAIL_TITLE` / `EMAIL_FROM_NAME`** — branding.

To change the schedule, edit `vercel.json`. Vercel cron uses standard cron syntax in **UTC**.

---

## Cost

- **Vercel**: free hobby tier
- **Anthropic**: ~$0.001/day on Haiku for the summary call
- **HN, GitHub, RSS**: free
- **Gmail**: free

Total: pennies per month, even running daily forever.

---

## Test it

After deploying, hit the endpoint manually:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-deployment.vercel.app/api/cron/digest
```

Or use `vercel curl` if Deployment Protection is on (which it is by default). The actual scheduled cron bypasses protection automatically.

---

## How it works

```
       ┌───────────┐   ┌──────────────┐   ┌─────────────────┐
       │ HN search │   │ 15 RSS feeds │   │ GitHub trending │
       └─────┬─────┘   └──────┬───────┘   └────────┬────────┘
             │                │                    │
             └────────┬───────┴────────────────────┘
                      ▼
            filter · dedupe · score · rank
                      │
                      ▼
            Claude Haiku — JSON digest
                      │
                      ▼
              styled HTML email
                      │
                      ▼
                 Gmail SMTP
                      │
                      ▼
                  your inbox
```

If anything crashes, you get an error email instead of silent failure.

---

## License

MIT. Fork it, tweak it, ship it.

---

Built by [Casey McDougal](https://caseymcdougal.dev). One of [the kits](https://caseymcdougal.dev/library).
