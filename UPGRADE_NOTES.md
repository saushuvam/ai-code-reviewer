# Upgrade Notes

What changed, where, and why — organized by the 5 upgrades you asked for.
Use this as your own reference, and as interview material ("walk me through
a project you built") — it maps each feature to a concrete engineering
decision rather than just a diff.

---

## 1. Streaming responses

**Problem before:** `/ai/get-review` called `model.generateContent()` and
made the user wait for the *entire* review before showing anything —
often several seconds of a blank screen.

**Changed:**
- `backend/src/services/ai.service.js` — added `generateContentStream()`, an
  async generator that wraps Gemini's `generateContentStream()` and yields
  text chunks as they arrive. The original `generateContent()` is kept
  (used by the non-streaming `/ai/get-review` endpoint, still handy for
  simple integrations or tests).
- `backend/src/controllers/ai.controller.js` — new `getReviewStream()`
  handler. Sets `Content-Type: text/plain`, disables proxy buffering
  (`X-Accel-Buffering: no`), and does `res.write(chunk)` in a loop as chunks
  arrive from the service, instead of `res.json()` once at the end.
- `backend/src/routes/ai.routes.js` — new route `POST /ai/get-review/stream`.
- `frontend/src/App.jsx` — replaced the single `axios.post()` call with
  `streamReview()`, which does `fetch()` and reads the response body with
  `response.body.getReader()`, appending each decoded chunk to React state
  (`setReview(prev => prev + chunk)`) as it arrives. Also added an
  `AbortController` so an in-flight review can be cancelled.

**Why plain-text streaming over Server-Sent Events (SSE):** `EventSource`
(the browser API for SSE) only supports GET requests, and code snippets can
be too large for a URL query string. Streaming plain text over a POST via
`fetch` + `ReadableStream` sidesteps that limit and is the same pattern
used by most LLM chat UIs.

---

## 2. GitHub repo / PR review

**New files:**
- `backend/src/services/github.service.js`
  - `parseGithubUrl(url)` — regex-parses a plain repo URL, a repo URL with
    `/tree/{branch}`, or a `/pull/{number}` URL into `{ type, owner, repo, ... }`.
  - `fetchPullRequestDiff(owner, repo, number)` — calls the GitHub API with
    `Accept: application/vnd.github.v3.diff` to get a unified diff directly.
  - `fetchRepoSourceBundle(owner, repo, branch)` — calls the git Trees API
    (`GET /repos/{o}/{r}/git/trees/{ref}?recursive=1`), filters to common
    code file extensions, and caps the result at 15 files / 20KB per file /
    150KB total so a full-repo review doesn't blow up the prompt size or
    your Gemini quota.
  - `formatFilesAsPrompt(files)` — joins fetched files into one prompt with
    `--- FILE: path ---` headers so the model can give per-file feedback.

**Changed:**
- `backend/src/controllers/ai.controller.js` — new `getRepoReview()`
  handler: parses the URL, branches on `type` (`pull` → diff, `repo` →
  file bundle), builds a prompt, and streams the result the same way
  `getReviewStream()` does.
- `backend/src/routes/ai.routes.js` — new route `POST /ai/get-repo-review`.
- `frontend/src/App.jsx` — added a mode toggle ("Paste Code" /
  "GitHub Repo / PR") that swaps the code editor for a URL input and
  points the same `streamReview()` helper at `/ai/get-repo-review` instead.

**Design call:** unauthenticated GitHub API access is rate-limited to 60
requests/hour, which is fine for demo/portfolio use but worth knowing.
`GITHUB_TOKEN` (see `.env.example`) bumps that to 5000/hour — no special
scopes needed for public repos.

---

## 3. Redis caching

**New files:**
- `backend/src/config/redis.js` — a singleton Redis client. Notably: if
  Redis is unreachable, it logs a warning and sets an internal `connected`
  flag to `false` instead of crashing the process. Every read/write goes
  through `isRedisConnected()` first.
- `backend/src/services/cache.service.js` — `getCachedReview(input)` /
  `setCachedReview(input, text, ttl)`. Keys are `review:<sha256(input)>`,
  TTL defaults to 24h. All Redis calls are wrapped in try/catch that
  degrades to "no cache" on any error.

**Changed:**
- `backend/src/controllers/ai.controller.js` — all three handlers
  (`getReview`, `getReviewStream`, `getRepoReview`) check the cache before
  calling Gemini, and write to it after a successful generation.
- `backend/package.json` — added the `redis` dependency.

**Why "fail open" instead of requiring Redis:** caching is a performance
optimization, not a correctness requirement. A resume project that hard-
crashes because a cache dependency isn't running is a worse demo than one
that just runs slightly slower. This also means you can `npm run dev` the
backend with zero setup and it behaves identically (just uncached).

**Cache key note:** the key is a hash of the *exact* input (code text, or
`github:<url>`), so caching is purely content-addressed — no separate
invalidation logic needed, since a one-character edit produces a new key
automatically.

---

## 4. Tests

**Backend — `backend/tests/` (Jest + Supertest), 38 tests, all passing:**
- `cache.service.test.js` — mocks `src/config/redis.js` entirely;
  verifies key hashing is deterministic, cache hit/miss/error paths.
- `github.service.test.js` — mocks `global.fetch`; verifies URL parsing
  for all supported formats, PR diff fetching, and repo tree filtering
  (confirms non-code files and directories are excluded).
- `ai.service.test.js` — mocks `@google/generative-ai`; verifies both the
  non-streaming and streaming generators, including that empty stream
  chunks are skipped.
- `ai.routes.test.js` — full integration tests via `supertest(app)`, with
  the service layer mocked, covering all three endpoints' success, cache-
  hit, validation, and error paths.

None of these require a live Gemini key, live Redis, or network access —
they're fully isolated with `jest.mock()`, which is what makes them safe
to run in CI on every push.

**Frontend — `frontend/src/App.test.jsx` (Vitest + React Testing Library), 6 tests:**
- Mode toggle switches the input view
- A mocked streaming `fetch` response renders progressively into markdown
- The GitHub mode sends `{ url }` to the right endpoint
- Failed requests surface an error message
- Empty input doesn't fire a request

**Config added:** `backend/package.json` (`jest` config block +
`tests/setup.js` to set `GOOGLE_GEMINI_KEY` before modules load),
`frontend/vitest.config.js`, `frontend/vitest.setup.js` (loads
`@testing-library/jest-dom` matchers), and an eslint override in
`frontend/eslint.config.js` so test files don't trip `no-undef` on
`global`/`vi`/`describe`.

---

## 5. CI/CD

**New file:** `.github/workflows/ci.yml` — two jobs, run on every push/PR
to `main`:
- **backend** — spins up a real `redis:7-alpine` service container (so the
  cache-hit paths are exercised against real Redis, not just mocks),
  installs deps with `npm ci`, runs `npm test`.
- **frontend** — installs deps, runs `npm run lint`, `npm test`, then
  `npm run build` as a final sanity check that the production bundle
  compiles.

This is CI, not full CD — it doesn't deploy anywhere, since that needs
secrets tied to a real hosting target (Render, Fly.io, etc.) that only you
can set up. If you want to add a deploy step: hosting providers like
Render/Railway support "deploy on push" directly from GitHub with zero
extra YAML, which is the easiest path for a portfolio project.

**Bonus, not requested but nearly free:**
- `Dockerfile` for both `backend/` and `frontend/`, plus root
  `docker-compose.yml` wiring them up with Redis — makes local setup a
  single `docker-compose up` and demonstrates containerization on your resume.
- `frontend/nginx.conf` — the frontend's production container serves the
  built SPA via nginx and reverse-proxies `/ai/*` to the backend container,
  with `proxy_buffering off` (streaming would silently stop working
  without this — nginx buffers responses by default).

---

## Other small changes worth knowing about

- **`backend/src/app.js`** — bumped `express.json()`'s body size limit to
  `2mb` (was Express's 100kb default), since larger code pastes were
  getting silently rejected.
- **`frontend/package.json`** — removed the `axios` dependency (no longer
  used now that streaming uses `fetch` directly).
- **`.env.example`** replaces the old committed `.env` file. **Important:**
  your original `.env` had a live Gemini key in it — rotate that key if you
  haven't already (see my previous message). The real `.env` is gitignored
  and was not included in this delivery.
- **`backend/package.json` / `frontend/package.json`** — added `engines`/
  test scripts and pinned new dependencies; lockfiles were regenerated via
  `npm install` and are included.

## Suggested next steps (not implemented, for when you want to go further)

- Rate limiting (`express-rate-limit`) on the review endpoints — cheap to
  add, protects your Gemini quota from abuse if this is ever publicly deployed.
- Swap in TypeScript for the backend — strong resume signal, and this
  codebase is small enough to convert in an afternoon.
- A `/health` endpoint that also reports Redis connectivity, useful once
  this is actually deployed somewhere with uptime monitoring.
