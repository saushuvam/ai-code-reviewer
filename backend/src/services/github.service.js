const GITHUB_API = 'https://api.github.com'

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx',
  '.py', '.java', '.go', '.rb', '.php',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.rs', '.swift', '.kt',
])

const MAX_FILES = 15
const MAX_FILE_BYTES = 20_000
const MAX_TOTAL_BYTES = 150_000

function githubHeaders(extra = {}) {
  const headers = {
    'User-Agent': 'ai-code-reviewer',
    Accept: 'application/vnd.github+json',
    ...extra,
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

/**
 * Parses either a repo URL or a pull-request URL into its parts.
 * Supported:
 *   https://github.com/{owner}/{repo}
 *   https://github.com/{owner}/{repo}/tree/{branch}
 *   https://github.com/{owner}/{repo}/pull/{number}
 */
function parseGithubUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A GitHub URL is required')
  }
  const cleaned = url.trim().replace(/\/+$/, '')

  const prMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i)
  if (prMatch) {
    return {
      type: 'pull',
      owner: prMatch[1],
      repo: prMatch[2].replace(/\.git$/, ''),
      number: Number(prMatch[3]),
    }
  }

  const repoMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+))?$/i)
  if (repoMatch) {
    return {
      type: 'repo',
      owner: repoMatch[1],
      repo: repoMatch[2].replace(/\.git$/, ''),
      branch: repoMatch[3],
    }
  }

  throw new Error('Unrecognized GitHub URL. Use a repo URL (https://github.com/owner/repo) or a pull request URL (.../pull/123).')
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: githubHeaders() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API error ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

/** Fetches a PR as a unified diff (patch format). */
async function fetchPullRequestDiff(owner, repo, number) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${number}`, {
    headers: githubHeaders({ Accept: 'application/vnd.github.v3.diff' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API error ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.text()
}

async function fetchRepoDefaultBranch(owner, repo) {
  const data = await fetchJson(`${GITHUB_API}/repos/${owner}/${repo}`)
  return data.default_branch
}

function getExtension(path) {
  const idx = path.lastIndexOf('.')
  return idx === -1 ? '' : path.slice(idx).toLowerCase()
}

/**
 * Walks a repo's git tree and pulls back a size-capped bundle of source
 * files so a full-repo review stays within a reasonable prompt size.
 */
async function fetchRepoSourceBundle(owner, repo, branch) {
  const ref = branch || (await fetchRepoDefaultBranch(owner, repo))
  const treeData = await fetchJson(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`)

  if (treeData.truncated) {
    console.warn(`[github] tree for ${owner}/${repo}@${ref} was truncated by the API; reviewing a subset of files`)
  }

  const candidates = (treeData.tree || [])
    .filter((item) => item.type === 'blob')
    .filter((item) => CODE_EXTENSIONS.has(getExtension(item.path)))
    .filter((item) => (item.size || 0) > 0 && item.size <= MAX_FILE_BYTES)
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.length - b.path.length)
    .slice(0, MAX_FILES)

  if (candidates.length === 0) {
    throw new Error('No reviewable source files found in this repository (checked common code file extensions only).')
  }

  const files = []
  let totalBytes = 0

  for (const item of candidates) {
    if (totalBytes >= MAX_TOTAL_BYTES) break
    const blob = await fetchJson(`${GITHUB_API}/repos/${owner}/${repo}/git/blobs/${item.sha}`)
    const content = blob.encoding === 'base64'
      ? Buffer.from(blob.content, 'base64').toString('utf-8')
      : blob.content
    totalBytes += content.length
    files.push({ path: item.path, content })
  }

  return files
}

function formatFilesAsPrompt(files) {
  return files.map((f) => `--- FILE: ${f.path} ---\n${f.content}`).join('\n\n')
}

module.exports = {
  parseGithubUrl,
  fetchPullRequestDiff,
  fetchRepoSourceBundle,
  formatFilesAsPrompt,
  // exported for tests
  CODE_EXTENSIONS,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
}
