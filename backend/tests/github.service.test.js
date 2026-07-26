const {
  parseGithubUrl,
  fetchPullRequestDiff,
  fetchRepoSourceBundle,
  formatFilesAsPrompt,
} = require('../src/services/github.service')

describe('parseGithubUrl', () => {
  it('parses a plain repo url', () => {
    expect(parseGithubUrl('https://github.com/octocat/hello-world')).toEqual({
      type: 'repo',
      owner: 'octocat',
      repo: 'hello-world',
      branch: undefined,
    })
  })

  it('parses a repo url with a trailing slash', () => {
    expect(parseGithubUrl('https://github.com/octocat/hello-world/')).toMatchObject({
      type: 'repo',
      owner: 'octocat',
      repo: 'hello-world',
    })
  })

  it('parses a repo url with .git suffix', () => {
    expect(parseGithubUrl('https://github.com/octocat/hello-world.git')).toMatchObject({
      owner: 'octocat',
      repo: 'hello-world',
    })
  })

  it('parses a repo url pointing at a branch', () => {
    expect(parseGithubUrl('https://github.com/octocat/hello-world/tree/develop')).toEqual({
      type: 'repo',
      owner: 'octocat',
      repo: 'hello-world',
      branch: 'develop',
    })
  })

  it('parses a pull request url', () => {
    expect(parseGithubUrl('https://github.com/octocat/hello-world/pull/42')).toEqual({
      type: 'pull',
      owner: 'octocat',
      repo: 'hello-world',
      number: 42,
    })
  })

  it('throws on an unrecognized url', () => {
    expect(() => parseGithubUrl('https://example.com/not-github')).toThrow(/Unrecognized GitHub URL/)
  })

  it('throws on an empty url', () => {
    expect(() => parseGithubUrl('')).toThrow(/required/)
  })
})

describe('fetchPullRequestDiff', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('returns the diff text on success', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => 'diff --git a/x b/x' })
    const diff = await fetchPullRequestDiff('octocat', 'hello-world', 42)
    expect(diff).toBe('diff --git a/x b/x')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/octocat/hello-world/pulls/42',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/vnd.github.v3.diff' }) })
    )
  })

  it('throws a descriptive error on failure', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not Found' })
    await expect(fetchPullRequestDiff('octocat', 'missing', 1)).rejects.toThrow(/GitHub API error 404/)
  })
})

describe('fetchRepoSourceBundle', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('fetches the tree, filters to code files, and inlines blob contents', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/git/trees/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            truncated: false,
            tree: [
              { type: 'blob', path: 'index.js', size: 100, sha: 'sha-index' },
              { type: 'blob', path: 'README.md', size: 50, sha: 'sha-readme' }, // filtered: not a code extension
              { type: 'tree', path: 'src', size: 0, sha: 'sha-dir' }, // filtered: directory
            ],
          }),
        })
      }
      if (url.includes('/git/blobs/sha-index')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ encoding: 'base64', content: Buffer.from('console.log(1)').toString('base64') }),
        })
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    const files = await fetchRepoSourceBundle('octocat', 'hello-world', 'main')
    expect(files).toEqual([{ path: 'index.js', content: 'console.log(1)' }])
  })

  it('throws when no reviewable files are found', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ truncated: false, tree: [{ type: 'blob', path: 'README.md', size: 10, sha: 'x' }] }),
    })
    await expect(fetchRepoSourceBundle('octocat', 'docs-only', 'main')).rejects.toThrow(/No reviewable source files/)
  })
})

describe('formatFilesAsPrompt', () => {
  it('joins files with a FILE header per file', () => {
    const out = formatFilesAsPrompt([
      { path: 'a.js', content: 'const a = 1' },
      { path: 'b.js', content: 'const b = 2' },
    ])
    expect(out).toContain('--- FILE: a.js ---\nconst a = 1')
    expect(out).toContain('--- FILE: b.js ---\nconst b = 2')
  })
})
