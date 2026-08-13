const GITHUB_API = "https://api.github.com";
const CACHE_TTL = 3600; // 1 hour

export interface GitHubStats {
  repos: number;
  stars: number;
  followers: number;
  topRepos: { name: string; stars: number; url: string }[];
}

/**
 * Fetch public GitHub stats for a user or organisation.
 * Uses Next.js ISR: data is revalidated every hour.
 */
export async function fetchGitHubStats(
  username: string
): Promise<GitHubStats | null> {
  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Singularity-Site",
    };

    // ── Profile (works for both users & orgs) ──────────────────────
    const profileRes = await fetch(`${GITHUB_API}/users/${username}`, {
      headers,
      next: { revalidate: CACHE_TTL },
    });
    if (!profileRes.ok) return null;
    const profile = await profileRes.json();

    // ── Repos (up to 100, sorted by stars) ─────────────────────────
    const reposRes = await fetch(
      `${GITHUB_API}/users/${username}/repos?per_page=100&sort=stars&direction=desc`,
      { headers, next: { revalidate: CACHE_TTL } }
    );
    const repos: { stargazers_count: number; name: string; html_url: string; fork: boolean }[] =
      reposRes.ok ? await reposRes.json() : [];

    // Only count non-fork repos
    const ownRepos = repos.filter((r) => !r.fork);
    const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0);
    const topRepos = ownRepos
      .filter((r) => r.stargazers_count > 0)
      .slice(0, 3)
      .map((r) => ({
        name: r.name,
        stars: r.stargazers_count,
        url: r.html_url,
      }));

    return {
      repos: profile.public_repos ?? ownRepos.length,
      stars: totalStars,
      followers: profile.followers ?? 0,
      topRepos,
    };
  } catch {
    return null;
  }
}
