import { Singularity } from "@/components/Singularity";
import { fetchGitHubStats } from "@/lib/github";
import { fetchLatestPost } from "@/lib/rss";

export default async function Page() {
  const [github, latestPost] = await Promise.all([
    fetchGitHubStats("SingularityCoLabs"),
    fetchLatestPost("https://dilandilruksha.dev"),
  ]);

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="hero">
        <Singularity />
        <div className="scrim" aria-hidden="true" />
        <h1 className="title">SINGULARITY</h1>
        <div className="scroll-hint" aria-hidden="true">
          <span>Scroll</span>
          <div className="scroll-hint-line" />
        </div>
      </section>

      {/* ─── Cards ────────────────────────────────────────────────────── */}
      <section className="cards-section">
        <div className="cards-grid">
          {/* Website card */}
          <a
            href="https://dilandilruksha.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="card"
            id="card-website"
          >
            <div className="card-top">
              <svg
                className="card-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <p className="card-label">Website</p>
              <h2 className="card-title">dilandilruksha.dev</h2>
              <p className="card-desc">
                Portfolio, projects, and everything in between. Built at the edge
                of what&apos;s possible.
              </p>
            </div>

            <div className="card-bottom">
              {latestPost && (
                <div className="card-latest">
                  <span className="card-latest-label">Latest</span>
                  <span className="card-latest-title">{latestPost.title}</span>
                  {latestPost.date && (
                    <span className="card-latest-date">{latestPost.date}</span>
                  )}
                </div>
              )}
              <span className="card-arrow">
                Visit
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </div>
          </a>

          {/* GitHub card */}
          <a
            href="https://github.com/SingularityCoLabs"
            target="_blank"
            rel="noopener noreferrer"
            className="card"
            id="card-github"
          >
            <div className="card-top">
              <svg
                className="card-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <p className="card-label">GitHub</p>
              <h2 className="card-title">SingularityCoLabs</h2>
              <p className="card-desc">
                Open source work, experiments, and the code behind the ideas.
                Contributions welcome.
              </p>
            </div>

            <div className="card-bottom">
              {github && (
                <div className="card-stats">
                  <div className="card-stat">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
                    </svg>
                    <span className="card-stat-value">{github.repos}</span>
                    <span className="card-stat-label">repos</span>
                  </div>
                  <div className="card-stat-divider" />
                  <div className="card-stat">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                    </svg>
                    <span className="card-stat-value">{github.stars}</span>
                    <span className="card-stat-label">stars</span>
                  </div>
                  {github.followers > 0 && (
                    <>
                      <div className="card-stat-divider" />
                      <div className="card-stat">
                        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                          <path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4.001 4.001 0 0 0-6.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 4.6 8.048 3.5 3.5 0 0 1 2 5.5ZM5.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5.5 0a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 11 4Z" />
                        </svg>
                        <span className="card-stat-value">{github.followers}</span>
                        <span className="card-stat-label">followers</span>
                      </div>
                    </>
                  )}
                </div>
              )}
              <span className="card-arrow">
                View Profile
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </div>
          </a>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="footer">
        © {new Date().getFullYear()} Singularity
      </footer>
    </>
  );
}
