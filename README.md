# CodeSense AI

CodeSense AI is an intelligent, developer-first AI code review platform designed to help engineers improve code quality, identify logical bugs and edge-case omissions, detect potential security vulnerabilities, and receive actionable code improvements powered by Google Gemini.

The platform provides a reactive interface with real-time streaming review generation, full syntax highlighting, resilient exponential backoff with model fallback, and support for auditing both pasted code snippets and live GitHub repositories / pull request diffs—accelerated by Redis caching.

![CI](https://github.com/saushuvam/ai-code-reviewer/actions/workflows/ci.yml/badge.svg)

---

## Table of Contents

- [Overview & Workflow](#overview--workflow)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## Overview & Workflow

CodeSense AI implements an end-to-end code analysis lifecycle:

```
[ Developer Input ]
  ├── Mode A: Paste raw code in the interactive syntax-highlighted editor
  └── Mode B: Provide a GitHub repo URL (sample tree) or Pull Request URL (unified diff)
          │
          ▼
[ Express API Gateway ]
  ├── Checks Redis sha256 content-addressed cache (instant return on hits)
  └── On cache miss: dispatches request to Gemini AI with active streaming
          │
          ▼
[ Google Gemini Engine ]
  ├── Analyzes syntax, concurrency, type safety, SOLID/DRY principles & security
  ├── Auto-retries transient 503/429 errors using exponential backoff & jitter
  └── Falls back to secondary model if primary model capacity is exhausted
          │
          ▼
[ Real-Time Client Stream ]
  ├── Streams plain-text chunks over HTTP to frontend ReadableStream reader
  └── Live-renders markdown and highlighted syntax blocks in PrismJS
```

---

## Key Features

### AI-Powered Code Review
- **Google Gemini Integration**: Configured with senior-engineer review instructions prioritizing correctness, readability, scalability, and security compliance.
- **Streaming Generation**: Response tokens stream incrementally into the browser via chunked transfer, eliminating multi-second blank loading pauses.
- **Resilient Retry & Model Fallback**: Handles transient upstream service hiccups (`503 Service Unavailable`, `429 Rate Limit`) through exponential backoff with jitter and automatic secondary model fallback (`GEMINI_FALLBACK_MODEL`).
- **Connection Lifecycle Awareness**: Aborts in-flight Gemini generation if a user cancels or closes their browser tab, preventing wasted token quota.

### GitHub Integration
- **Pull Request Review**: Fetches unified diff patches directly from GitHub API (`/repos/{owner}/{repo}/pulls/{number}`) with surrounding context.
- **Repository Source Bundle Review**: Traverses the git tree (`/repos/{owner}/{repo}/git/trees/{ref}?recursive=1`), filters relevant code extensions, and bundles source files with safety caps (≤15 files, ≤20KB per file, ≤150KB total) to protect context windows.
- **Authentication Flexibility**: Works unauthenticated (60 req/hour rate limit) or authenticated via `GITHUB_TOKEN` (5,000 req/hour).

### High-Performance Caching
- **Redis Content-Addressed Caching**: Review responses are indexed by `review:<sha256(input)>` with a 24-hour TTL, ensuring repeat reviews for identical code snippets or PR URLs are returned instantly.
- **Fail-Open Resilience**: Redis is an optimization, not a hard dependency. If Redis is unavailable or disconnected, the application continues serving fresh reviews seamlessly without crashing.

### Responsive Developer Interface
- **Interactive Code Editor**: Syntax-highlighted code editor supporting JavaScript, TypeScript, Python, and other languages powered by PrismJS.
- **Live Markdown Renderer**: Lightweight, dependency-free Markdown-to-HTML parser rendering code blocks, headers, bullet points, and callouts with dark developer-tool styling.
- **In-Flight Cancellation**: Review button dynamically changes to a cancellation trigger while a review is streaming.

---

## Architecture

```
┌─────────────────┐      POST /ai/get-review/stream      ┌──────────────────┐      ┌────────────┐
│                 │ ───────────────────────────────────▶ │                  │ ───▶ │   Redis    │
│   CodeSense AI  │      POST /ai/get-repo-review        │  Express Backend │      │  (Cache)   │
│  React Frontend │ ◀─────────────────────────────────── │   (Node.js 20)   │      └────────────┘
│  (Vite + Prism) │      streamed plain-text chunks      │                  │
└─────────────────┘                                      └────────┬─────────┘
                                                                  │
                                                  ┌───────────────┴───────────────┐
                                                  ▼                               ▼
                                         ┌─────────────────┐             ┌──────────────────┐
                                         │  Gemini API     │             │  GitHub REST API │
                                         │ (3.5-flash /    │             │ (Repo trees, PR  │
                                         │  fallback-lite) │             │  diffs)          │
                                         └─────────────────┘             └──────────────────┘
```

---

## Technology Stack

- **Frontend**:
  - React 18 (`react`, `react-dom`)
  - Vite (`@vitejs/plugin-react`)
  - `react-simple-code-editor`
  - PrismJS (syntax highlighting & theme)
  - Vitest + `@testing-library/react` (unit & integration testing)
- **Backend**:
  - Node.js (v18+)
  - Express 5 (`express`)
  - `@google/generative-ai` (Google Gemini SDK)
  - `redis` (Redis client with fail-open connection management)
  - `cors` & `dotenv`
  - Jest & Supertest (API & route testing)
- **Infrastructure & Tools**:
  - Docker & Docker Compose
  - Nginx (production reverse proxy in Docker)
  - GitHub Actions CI (Ubuntu, Node 20, real Redis service container)

---

## Project Structure

```
.
├── backend/
│   ├── server.js                     # HTTP server entrypoint
│   ├── src/
│   │   ├── app.js                    # Express application and route mounting
│   │   ├── config/
│   │   │   └── redis.js              # Singleton Redis connection manager (fail-open)
│   │   ├── controllers/
│   │   │   └── ai.controller.js      # Streaming & non-streaming review controllers
│   │   ├── routes/
│   │   │   └── ai.routes.js          # /ai endpoint definitions
│   │   └── services/
│   │       ├── ai.service.js         # Gemini model setup, retries, fallback & streaming
│   │       ├── cache.service.js      # Content-addressed sha256 Redis caching
│   │       └── github.service.js     # URL parsing, GitHub tree bundling & PR diff fetch
│   ├── tests/                        # Jest & Supertest suites (40 tests)
│   ├── Dockerfile                    # Production backend container definition
│   └── .env.example                  # Environment configuration template
├── frontend/
│   ├── index.html                    # Single-page application HTML template
│   ├── src/
│   │   ├── App.jsx                   # Main review workbench, mode toggle, stream handler
│   │   ├── App.css                   # Dark developer-tool UI stylesheet
│   │   ├── App.test.jsx              # Vitest + RTL test suite
│   │   └── main.jsx                  # React DOM mount point
│   ├── public/                       # Static assets and icons
│   ├── Dockerfile                    # Production frontend container (build + Nginx)
│   ├── nginx.conf                    # Nginx reverse proxy configuration
│   ├── vite.config.js                # Vite build and development proxy configuration
│   └── vitest.config.js              # Vitest test configuration
├── docker-compose.yml                # Multi-container orchestration (backend, frontend, redis)
└── .github/workflows/
    └── ci.yml                        # GitHub Actions automated test & build pipeline
```

---

## Installation & Setup

### Prerequisites

- Node.js `>= 18.0.0`
- npm `>= 9.0.0`
- A Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/apikey))
- *(Optional)* Docker and Docker Compose
- *(Optional)* Redis server running locally on `localhost:6379`

### Option 1: Running with Docker (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/saushuvam/ai-code-reviewer.git
cd ai-code-reviewer

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and provide your GOOGLE_GEMINI_KEY

# 3. Build and launch services
docker-compose up --build
```

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3000

---

### Option 2: Running Locally

#### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Open backend/.env and populate GOOGLE_GEMINI_KEY

npm install
npm run dev
# Backend starts on http://localhost:3000
```

#### 2. Frontend Setup (Separate Terminal)

```bash
cd frontend
npm install
npm run dev
# Frontend dev server starts on http://localhost:5173 (proxies /ai to :3000)
```

#### 3. Redis Setup *(Optional)*

Redis is completely optional. If not running, CodeSense AI operates normally with caching gracefully bypassed:

```bash
docker run -d -p 6379:6379 --name codesense-redis redis:7-alpine
```

---

## Environment Variables (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_GEMINI_KEY` | **Yes** | — | Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | No | `gemini-3.5-flash` | Primary Gemini model identifier used for analysis. |
| `GEMINI_FALLBACK_MODEL` | No | `gemini-3.5-flash-lite` | Secondary fallback model invoked if primary hits capacity limits. |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL. If unreachable, caching is disabled gracefully. |
| `GITHUB_TOKEN` | No | — | GitHub Personal Access Token. Raises rate limit from 60 to 5,000 req/hr. |

---

## API Reference

### 1. Code Review (Streaming)
- **Endpoint**: `POST /ai/get-review/stream`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "code": "function sum(a, b) { return a + b; }"
  }
  ```
- **Response**: Streamed `text/plain; charset=utf-8` chunks.

### 2. Code Review (Non-Streaming JSON)
- **Endpoint**: `POST /ai/get-review`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "code": "function sum(a, b) { return a + b; }"
  }
  ```
- **Response**:
  ```json
  {
    "review": "### Code Review\n\n...",
    "cached": false
  }
  ```

### 3. GitHub Repository / Pull Request Review
- **Endpoint**: `POST /ai/get-repo-review`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "url": "https://github.com/octocat/hello-world/pull/42"
  }
  ```
  *or*
  ```json
  {
    "url": "https://github.com/octocat/hello-world"
  }
  ```
- **Response**: Streamed `text/plain; charset=utf-8` chunks.

---

## Testing

Both the backend and frontend include automated test suites with zero external service dependencies (all network calls, GitHub APIs, and Gemini models are mocked):

```bash
# Run backend test suite (Jest + Supertest)
cd backend
npm test

# Run frontend test suite (Vitest + React Testing Library)
cd frontend
npm test
```

---

## CI/CD Pipeline

The project includes an automated GitHub Actions pipeline ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) triggered on every push and pull request to `main`:

1. **Backend Job**:
   - Boots a live Redis 7 Alpine service container.
   - Installs dependencies (`npm ci`).
   - Runs Jest test suites with Supertest API verifications.
2. **Frontend Job**:
   - Installs dependencies (`npm ci`).
   - Executes ESLint validation (`npm run lint`).
   - Runs Vitest component & streaming tests (`npm test`).
   - Executes production Vite bundle compilation (`npm run build`).

---

## Future Improvements

- **Interactive Review Chat**: Support multi-turn Q&A follow-ups on generated code reviews.
- **Custom Rule Presets**: Allow users to toggle review strictness (e.g. strict security vs. algorithmic efficiency).
- **IDE Extensions**: Direct integrations for VS Code and JetBrains IDEs.
- **Expanded File Formats**: Additional language parsers for IaC files (Terraform, Dockerfile, Kubernetes manifests).

---

## License

This project is licensed under the ISC License.
