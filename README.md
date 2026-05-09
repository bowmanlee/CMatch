# CMatch

> Chinese Medicine practitioner matching via conversational AI intake.

CMatch is a prototype web application that helps patients structure their Chinese Medicine concerns into safety-aware, explainable practitioner matches. It uses a conversational interface powered by DeepSeek AI to extract structured intake data and match against a curated practitioner database.

---

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   React SPA │────▶│ Vercel Function │────▶│  DeepSeek API│
│   (Vite)    │     │ api/conversation│     │  (LLM)       │
└─────────────┘     └─────────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Cloudflare   │
                    │ Turnstile    │
                    │ (bot check)  │
                    └──────────────┘
```

- **Frontend**: React 19 + TypeScript + Vite, vanilla CSS
- **Backend**: Vercel serverless function (`api/conversation.mjs`)
- **Shared core**: `server/core.mjs` — single source of truth for prompts, schema normalization, and DeepSeek API logic (used by both local dev and production)
- **Bot protection**: Cloudflare Turnstile (invisible challenge on first interaction)

---

## Local Development

```bash
# Install dependencies
npm install

# Start local dev (Vite client + API proxy)
npm run dev

# Or run separately
npm run dev:client   # Vite on http://localhost:5173
npm run dev:api      # API proxy on http://127.0.0.1:8787
```

Create a `.env` file (see `.env.example`):

```bash
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat
ALLOWED_ORIGIN=https://your-project.vercel.app
TURNSTILE_SECRET_KEY=0x...
```

---

## Deployment to Vercel

### 1. Rotate your DeepSeek API key

If this repository was ever shared or the key appeared in chat history, generate a new key at [platform.deepseek.com](https://platform.deepseek.com) before deploying.

### 2. Connect repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `bowmanlee/CMatch`
3. Framework preset: **Vite**

### 3. Environment variables

Add these in the Vercel dashboard (**Settings → Environment Variables**):

| Variable | Value | Secret? |
|----------|-------|---------|
| `DEEPSEEK_API_KEY` | `sk-...` | ✅ Yes |
| `DEEPSEEK_MODEL` | `deepseek-chat` | No |
| `ALLOWED_ORIGIN` | `https://your-project.vercel.app` | No |
| `TURNSTILE_SECRET_KEY` | `0x...` | ✅ Yes |

> **Note**: `ALLOWED_ORIGIN` must match your production domain exactly. Include `https://`.

### 4. Deploy

Click **Deploy**. Vercel will:
- Build the SPA (`npm run build` → `dist/`)
- Deploy `api/conversation.mjs` as a serverless function
- Apply SPA rewrites from `vercel.json`

### 5. Add Turnstile site key to frontend

1. Create a Turnstile site at [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile
2. Copy the **Site Key**
3. In `src/App.tsx`, set `TURNSTILE_SITE_KEY` to your site key (this is public and safe to embed)

---

## Security Notes

- **Zero-PHI logging**: Server logs never contain user message content, schema fields, or raw LLM responses. Only metadata (model, message count, status) is logged.
- **Debug page**: Only loads in development (`import.meta.env.DEV`). Production builds tree-shake it out completely.
- **CORS**: Exact-match allowlist, not prefix matching. Localhost origins are hardcoded; production origin comes from `ALLOWED_ORIGIN`.
- **Request timeout**: All DeepSeek API calls use `AbortController` with a 30-second timeout.
- **Bot protection**: Cloudflare Turnstile verifies every API request. Invalid tokens receive HTTP 403.
- **No client-side secrets**: The broken `X-API-Key` approach was removed. Abuse protection comes from Turnstile + edge rate limiting, not shared secrets in client bundles.

---

## Project Structure

```
├── api/
│   └── conversation.mjs          # Vercel serverless function
├── server/
│   ├── core.mjs                  # Shared AI logic (prompts, DeepSeek client, schema normalization)
│   └── deepseek-proxy.mjs        # Local dev API proxy
├── shared/
│   ├── practitioners.json        # Practitioner database
│   └── practitioners.ts          # TypeScript types
├── src/
│   ├── App.tsx                   # Main app + chat UI
│   ├── App.css                   # All styles
│   └── DebugPage.tsx             # Dev-only debug view
├── vercel.json                   # Vercel config (build, rewrites)
└── vite.config.ts                # Vite dev config
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API key |
| `DEEPSEEK_MODEL` | No | Model name (default: `deepseek-chat`) |
| `DEEPSEEK_BASE_URL` | No | API base URL (default: `https://api.deepseek.com`) |
| `ALLOWED_ORIGIN` | For production | Your Vercel domain for CORS |
| `TURNSTILE_SECRET_KEY` | For production | Cloudflare Turnstile secret |
| `CMATCH_API_HOST` | Local dev only | Proxy bind host (default: `127.0.0.1`) |
| `CMATCH_API_PORT` | Local dev only | Proxy bind port (default: `8787`) |

---

## Compliance Note

Patient symptoms and preferences are sent to DeepSeek (third-party API). No Business Associate Agreement (BAA) or Data Processing Agreement (DPA) is in place. This is a **prototype-level deployment** — not suitable for production healthcare use without legal review.
