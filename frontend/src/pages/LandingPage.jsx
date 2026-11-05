export default function LandingPage({ navigate, user }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing-page">
      <div className="landing-bg-glow" />

      {/* Navigation Bar */}
      <header className="saas-nav">
        <div className="brand-logo" onClick={() => navigate('/')}>
          <div className="logo-badge">&lt;/&gt;</div>
          <span className="brand-name">CodeSense AI</span>
        </div>

        <nav className="nav-links">
          <button className="nav-link" onClick={() => scrollTo('features')}>Features</button>
          <button className="nav-link" onClick={() => scrollTo('how-it-works')}>How It Works</button>
          <button className="nav-link" onClick={() => scrollTo('why-choose')}>Why Us</button>
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <button className="btn-ghost" onClick={() => navigate('/dashboard')}>
                Dashboard ({user.name.split(' ')[0]})
              </button>
              <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                Open App &rarr;
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => navigate('/signin')}>
                Sign In
              </button>
              <button className="btn-primary" onClick={() => navigate('/signup')}>
                Get Started
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-pill">
          <span>✨ Powered by Next-Gen Google Gemini</span>
        </div>

        <h1 className="hero-title">
          Write Better Code. <br />
          <span className="gradient-text">Ship With Confidence.</span>
        </h1>

        <p className="hero-subtitle">
          Your intelligent AI code review assistant. Detect bugs, identify potential security risks,
          and improve maintainability with actionable, streaming AI insights.
        </p>

        <div className="hero-ctas">
          <button
            className="btn-primary btn-large"
            onClick={() => navigate(user ? '/dashboard' : '/signup')}
          >
            {user ? 'Go to Dashboard' : 'Get Started Free'} &rarr;
          </button>
          <button className="btn-ghost btn-large" onClick={() => scrollTo('features')}>
            Explore Features
          </button>
        </div>

        {/* Live Interface Preview */}
        <div className="hero-preview-container">
          <div className="preview-window-bar">
            <div className="window-dot dot-red" />
            <div className="window-dot dot-yellow" />
            <div className="window-dot dot-green" />
            <span className="window-title">review_session_preview.js</span>
          </div>

          <div className="preview-content">
            <div className="preview-pane-code">
              <span className="preview-badge">INPUT CODE</span>
              <pre>
{`function transferFunds(user, amount) {
  if (user.balance >= amount) {
    user.balance -= amount;
    return sendToBank(user.id, amount);
  }
  return false;
}`}
              </pre>
            </div>
            <div className="preview-pane-review">
              <span className="preview-badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>
                AI CODE REVIEW
              </span>
              <p><strong>⚠️ Concurrency &amp; Re-entrancy Risk:</strong></p>
              <p>The balance is decremented before the async bank dispatch resolves. If <code>sendToBank</code> fails, the balance remains deducted.</p>
              <p><strong>Recommendation:</strong> Wrap in an atomic transaction or implement a compensating rollback step.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section">
        <div className="section-header">
          <div className="section-tag">Capabilities</div>
          <h2 className="section-title">Designed for Developer Excellence</h2>
          <p className="section-desc">
            Everything you need to audit pull requests, optimize algorithms, and adhere to industry standards.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">⚡</div>
            <h3>Streaming AI Reviews</h3>
            <p>
              Watch review feedback stream in real time without waiting seconds for full responses to generate.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">🔍</div>
            <h3>Intelligent Bug Detection</h3>
            <p>
              Spot logical flaws, edge-case omissions, off-by-one errors, and memory leaks before they hit staging.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">🛡️</div>
            <h3>Security Compliance</h3>
            <p>
              Inspect inputs for common vulnerabilities, including SQL injection, XSS vectors, and unsafe deserialization.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">🐙</div>
            <h3>GitHub Repo &amp; PR Audits</h3>
            <p>
              Review full repositories or directly analyze live pull request diffs by pasting a public GitHub URL.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">🚀</div>
            <h3>Redis Accelerated Caching</h3>
            <p>
              Instantly retrieve repeat code reviews through sha256 content-addressed Redis caching.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">📐</div>
            <h3>SOLID &amp; DRY Analysis</h3>
            <p>
              Receive concrete refactoring suggestions that eliminate boilerplate and decouple components.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="section">
        <div className="section-header">
          <div className="section-tag">Workflow</div>
          <h2 className="section-title">How It Works</h2>
          <p className="section-desc">
            Three simple steps to transform your code quality workflow.
          </p>
        </div>

        <div className="workflow-steps">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Submit Your Code</h3>
            <p>Paste any snippet into the live syntax-highlighted editor or provide a GitHub repository or pull request URL.</p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h3>AI Deep Analysis</h3>
            <p>The Gemini engine analyzes your syntax, architecture, type-safety, and potential runtime vulnerabilities.</p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Get Actionable Insights</h3>
            <p>Receive formatted, prioritized suggestions, code patches, and clean refactoring alternatives in real time.</p>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section id="why-choose" className="section">
        <div className="section-header">
          <div className="section-tag">Advantage</div>
          <h2 className="section-title">Why Developers Choose CodeSense AI</h2>
        </div>

        <div className="benefits-grid">
          <div className="benefit-card">
            <span className="benefit-check">✓</span>
            <div>
              <h4>Faster Review Cycles</h4>
              <p>Eliminate PR review bottlenecks with instant AI first-pass feedback.</p>
            </div>
          </div>
          <div className="benefit-card">
            <span className="benefit-check">✓</span>
            <div>
              <h4>Production-Ready Output</h4>
              <p>Actionable code suggestions you can copy-paste straight into your IDE.</p>
            </div>
          </div>
          <div className="benefit-card">
            <span className="benefit-check">✓</span>
            <div>
              <h4>Zero Fluff &amp; High Signal</h4>
              <p>Concise senior-engineer level critique focusing on security, performance, and structure.</p>
            </div>
          </div>
          <div className="benefit-card">
            <span className="benefit-check">✓</span>
            <div>
              <h4>Continuous Reliability</h4>
              <p>Equipped with automatic exponential backoff, jitter retries, and secondary model fallback.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="section">
        <div className="cta-banner">
          <h2>Ready to Write Better Code?</h2>
          <p>
            Join developers using intelligent AI review to catch regressions early and ship with absolute confidence.
          </p>
          <button
            className="btn-primary btn-large"
            onClick={() => navigate(user ? '/dashboard' : '/signup')}
          >
            {user ? 'Enter Dashboard' : 'Get Started Free'} &rarr;
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="saas-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="brand-logo" onClick={() => navigate('/')}>
              <div className="logo-badge">&lt;/&gt;</div>
              <span className="brand-name">CodeSense AI</span>
            </div>
            <p>
              Autonomous, high-speed code review assistant powered by Google Gemini and enterprise caching.
            </p>
          </div>

          <div className="footer-column">
            <h4>Product</h4>
            <ul>
              <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
              <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a></li>
              <li><a href="#why-choose" onClick={(e) => { e.preventDefault(); scrollTo('why-choose'); }}>Why Choose Us</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>Access</h4>
            <ul>
              <li><a href="/signin" onClick={(e) => { e.preventDefault(); navigate('/signin'); }}>Sign In</a></li>
              <li><a href="/signup" onClick={(e) => { e.preventDefault(); navigate('/signup'); }}>Create Account</a></li>
              <li><a href="/dashboard" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>Dashboard</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>Open Source</h4>
            <ul>
              <li>
                <a href="https://github.com/saushuvam/ai-code-reviewer" target="_blank" rel="noopener noreferrer">
                  GitHub Repository
                </a>
              </li>
              <li><a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer">Google Gemini</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} CodeSense AI. All rights reserved.</span>
          <span>Crafted for developers worldwide.</span>
        </div>
      </footer>
    </div>
  )
}

