# Medical Summary Revision Tool

A lightweight web tool that revises draft medical summaries for clarity, readability, and grammatical accuracy — while strictly preserving the original clinical content and structure.

🔗 **Live site:** https://med-chart-reviser.netlify.app/

## Overview

Paste a draft medical summary and the tool returns an editorially-revised version. The revision is **purely editorial**: it refines language, phrasing, and grammar without adding, removing, or altering any clinical information. It enforces a consistent house style (continuous prose, American English, a standardized vital-signs sentence) and can show a side-by-side diff of the changes.

The browser never sees any API keys. Requests are proxied through a Netlify serverless function that injects the model API key from a server-side environment variable.

## Features

- **Single-page UI** — no build step, no framework; just one `index.html`.
- **Side-by-side / output-only views** — compare the draft against the revision, or focus on the result.
- **Inline diff** — highlights added and removed words (LCS-based word diff).
- **Model selection** — choose from several Groq-hosted models.
- **Access-token gate** — a shared token (checked server-side) controls who can call the API.
- **Copy to clipboard** and word/character counters.
- **Light & dark mode** — follows the system color scheme.

## How it works

```
Browser (index.html)
      │  POST /api/revise  { model, summary, accessToken }
      ▼
Netlify Function (netlify/functions/revise.js)
      │  validates access token
      │  calls Groq Chat Completions API with a fixed system prompt
      ▼
Groq API  ──►  revised summary  ──►  back to the browser
```

### The editorial rules

The system prompt in the serverless function instructs the model to:

- Preserve all clinical meaning — never add new information or change statements.
- Use continuous, flowing prose (no bullet points, lists, headings, bold, or italics).
- Write vital signs in a standardized sentence, introduced with contextual phrasing (e.g. "at triage").
- Use American English spelling and conventions throughout.

## Project structure

```
.
├── index.html                  # The entire front-end (HTML, CSS, and inline JS)
├── netlify/
│   └── functions/
│       └── revise.js           # Serverless proxy → Groq API (route: /api/revise)
├── LICENSE
└── README.md
```

## Configuration

The serverless function reads two environment variables (set them in **Netlify → Site configuration → Environment variables**):

| Variable        | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| `GROQ_API_KEY`  | API key for the [Groq](https://groq.com/) Chat Completions API.    |
| `ACCESS_TOKEN`  | Shared secret a user must enter in the UI to authorize a request.  |

## Available models

The **Model settings** panel loads the current model list live from Groq
(`GET /api/revise`, which proxies Groq's `/models` endpoint), so the dropdown
stays up to date automatically as Groq adds or retires models — there is no
hardcoded list to go stale. Non-chat models (Whisper, TTS, guard, embeddings)
are filtered out. An **Include all providers** checkbox reveals additional
model families (Qwen, DeepSeek, Kimi, etc.) beyond the OpenAI/Groq defaults.

- **Default:** `openai/gpt-oss-20b` (fast, low cost) — also the server-side
  fallback used when a request omits the model.
- **Higher quality:** `openai/gpt-oss-120b`.
- If the live list can't be fetched, the UI falls back to a small built-in
  list of current production models.

> Groq's catalog changes over time. Because the list is fetched live, the app
> only ever offers models your `GROQ_API_KEY` actually has access to.

## Local development

This is a static page plus a Netlify Function. The easiest way to run both together locally is the Netlify CLI:

```bash
npm install -g netlify-cli

# Provide the required secrets to the local function runtime
export GROQ_API_KEY=your_groq_key
export ACCESS_TOKEN=your_shared_token

# Serve index.html and the function (with the /api/revise redirect) together
netlify dev
```

Then open the URL that `netlify dev` prints (typically http://localhost:8888).

> Opening `index.html` directly in a browser will render the UI, but the **Revise** button will fail because the `/api/revise` function isn't running.

## Deployment

The site deploys to Netlify automatically. Pushing to `main` triggers a production deploy, and pull requests get a deploy preview. No build command is required — Netlify serves `index.html` and bundles the function under `netlify/functions/`.

## Privacy & safety

- **De-identify patient data before use.** Do not paste identifiable PHI.
- The tool does **not** store any input or output; summaries are processed in-flight and discarded.
- API keys live only in Netlify environment variables and are never exposed to the browser.

> This tool is an editorial aid and is **not** a medical device. Always have a qualified clinician review any output before it is used.

## License

See [LICENSE](LICENSE).
