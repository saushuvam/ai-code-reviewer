# AI Code Reviewer

An AI-powered code review tool built with React and Express. Paste a code
snippet, a GitHub repo URL, or a pull request link, and get a streamed,
structured review from Google's Gemini model — with review results cached
in Redis so repeat requests are instant.

> Update the badge URL below to `your-username/your-repo` once you push
> this to GitHub, and it'll reflect the live CI status.

![CI](https://github.com/your-username/your-repo/actions/workflows/ci.yml/badge.svg)

## Features

- **Streamed reviews** — the model's output renders token-by-token in the UI instead of waiting on one long request
- **GitHub integration** — paste a repo URL to review a sample of its source files, or a pull request URL to review just the diff
- **Redis caching** — identical inputs are served from cache instead of re-calling the model (fails open: the app runs fine without Redis, just without the speedup)
- **Tested** — 38 backend tests (Jest + Supertest) and 6 frontend tests (Vitest + React Testing Library), all mocked so they run without live credentials
- **CI** — GitHub Actions runs the full test suite (with a real Redis service container), lint, and a production build on every push/PR
- **Containerized** — `docker-compose up` brings up the backend, frontend, and Redis together

## Architecture

```
┌─────────────┐      POST /ai/get-review/stream      ┌──────────────┐      ┌────────────┐
│             │ ───────────────────────────────────▶ │              │ ───▶ │   Redis    │
│   React     │      POST /ai/get-repo-review         │   Express    │      │  (cache)   │
│  frontend   │ ◀─────────────────────────────────── │   backend    │      └────────────┘
│  (Vite)     │      streamed text/plain chunks       │              │
└─────────────┘                                       └──────┬───────┘
                                                              │
                                              ┌───────────────┼───────────────┐
                                              ▼                               ▼
                                     ┌─────────────────┐           ┌──────────────────┐
                                     │  Gemini API      │           │  GitHub REST API │
                                     │ (generateContent  │           │ (repo trees, PR  │
                                     │  Stream)          │           │  diffs)          │
                                     └─────────────────┘           └──────────────────┘
```

**Request flow for a code review:**
1. Frontend POSTs code to `/ai/get-review/stream`
2. Backend hashes the input and checks Redis — on a hit, it writes the cached text straight back
3. On a miss, it calls Gemini's streaming API and forwards each chunk to the client as it arrives, then caches the full result
4. Frontend reads the response body with a `ReadableStream` reader and appends chunks to the rendered markdown as they land

**Request flow for a GitHub review** is the same, except the backend first resolves the URL into either a PR diff or a capped bundle of source files (≤15 files, ≤20KB each, ≤150KB total) before sending it to Gemini.

## Tech stack

| Layer      | Tech |
|------------|------|
| Frontend   | React 18, Vite, `react-simple-code-editor`, PrismJS |
| Backend    | Node.js, Express 5 |
| AI         | Google Gemini (`@google/generative-ai`, streaming) |
| Cache      | Redis (`redis` npm client) |
| External   | GitHub REST API (repo trees, blobs, PR diffs) |
| Testing    | Jest + Supertest (backend), Vitest + React Testing Library (frontend) |
| CI/CD      | GitHub Actions |
| Containers | Docker, docker-compose, nginx (frontend reverse proxy) |

## Project structure

```
.
├── backend/
│   ├── server.js
│   ├── src/
│   │   ├── app.js                    # Express app setup
│   │   ├── config/redis.js           # Redis client (fails open if unreachable)
│   │   ├── controllers/ai.controller.js
│   │   ├── routes/ai.routes.js
│   │   └── services/
│   │       ├── ai.service.js         # Gemini calls (streaming + non-streaming)
│   │       ├── cache.service.js      # get/set review cache
│   │       └── github.service.js     # URL parsing, PR diffs, repo file bundles
│   ├── tests/                        # Jest + Supertest
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # mode toggle, streaming fetch, markdown render
│   │   └── App.test.jsx              # Vitest + RTL
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vitest.config.js
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Getting started

### Option A — Docker (recommended)

```bash
cp backend/.env.example backend/.env
# edit backend/.env and set GOOGLE_GEMINI_KEY

GOOGLE_GEMINI_KEY=your_key docker-compose up --build
```

- Frontend: http://localhost:8080
- Backend: http://localhost:3000

### Option B — Run locally

Requires Node.js 18+. Redis is optional — the app runs fine without it, just without caching.

```bash
# Backend
cd backend
cp .env.example .env    # then add your GOOGLE_GEMINI_KEY
npm install
npm run dev              # http://localhost:3000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173, proxies /ai to :3000

# Redis (optional, separate terminal)
docker run -p 6379:6379 redis:7-alpine
```

## Environment variables (`backend/.env`)

| Variable            | Required | Description |
|---------------------|----------|-------------|
| `GOOGLE_GEMINI_KEY`  | Yes      | Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `REDIS_URL`          | No       | Defaults to `redis://localhost:6379`. If unreachable, caching is silently disabled. |
| `GITHUB_TOKEN`       | No       | Personal access token. Without it, GitHub review works but is limited to 60 requests/hour (unauthenticated); with it, 5000/hour. |

## API

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/ai/get-review` | POST | `{ "code": "..." }` | `{ "review": "...", "cached": bool }` — JSON, non-streamed |
| `/ai/get-review/stream` | POST | `{ "code": "..." }` | `text/plain`, streamed |
| `/ai/get-repo-review` | POST | `{ "url": "https://github.com/owner/repo" }` or a `.../pull/123` URL | `text/plain`, streamed |

## Testing

```bash
cd backend && npm test     # 38 tests — Jest + Supertest, all mocked (no live Redis/Gemini needed)
cd frontend && npm test    # 6 tests — Vitest + React Testing Library
```

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:
- **Backend job** — spins up a real Redis service container, installs deps, runs the full Jest suite
- **Frontend job** — installs deps, lints, runs Vitest, and does a production `vite build`

## Notes / known limitations

- GitHub repo review reviews a capped sample of source files, not the entire repository — this keeps prompts within a reasonable size for large repos.
- Caching is content-addressed (a hash of the input), so editing even one character produces a fresh review.
- The `/ai/get-review` (non-streaming) endpoint is kept for simple integrations/tests; the frontend uses the streaming endpoint exclusively.
