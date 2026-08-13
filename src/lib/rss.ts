const CACHE_TTL = 3600; // 1 hour

export interface FeedItem {
  title: string;
  link: string;
  date: string | null;
}

/**
 * Try to fetch the latest post from an RSS/Atom feed.
 * Attempts several common feed paths and returns the first match.
 */
export async function fetchLatestPost(
  siteUrl: string
): Promise<FeedItem | null> {
  const base = siteUrl.replace(/\/+$/, "");
  const feedPaths = [
    "/rss.xml",
    "/feed.xml",
    "/feed",
    "/atom.xml",
    "/index.xml",
    "/blog/rss.xml",
    "/blog/feed.xml",
  ];

  for (const path of feedPaths) {
    try {
      const res = await fetch(`${base}${path}`, {
        next: { revalidate: CACHE_TTL },
        headers: { "User-Agent": "Singularity-Site" },
      });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();

      // Quick check: does this look like XML/RSS?
      if (
        !text.includes("<rss") &&
        !text.includes("<feed") &&
        !text.includes("<item") &&
        !text.includes("<entry")
      ) {
        continue;
      }

      const item = parseFirstItem(text);
      if (item) return item;
    } catch {
      continue;
    }
  }

  return null;
}

/** Pull the first <item> (RSS) or <entry> (Atom) from raw XML. */
function parseFirstItem(xml: string): FeedItem | null {
  // RSS 2.0
  const rssMatch = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (rssMatch) {
    const block = rssMatch[1];
    return {
      title: extractTag(block, "title"),
      link: extractTag(block, "link") || extractTag(block, "guid"),
      date: formatDate(extractTag(block, "pubDate")),
    };
  }

  // Atom
  const atomMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (atomMatch) {
    const block = atomMatch[1];
    const linkMatch = block.match(/<link[^>]+href="([^"]+)"/);
    return {
      title: extractTag(block, "title"),
      link: linkMatch?.[1] || extractTag(block, "link"),
      date: formatDate(
        extractTag(block, "published") || extractTag(block, "updated")
      ),
    };
  }

  return null;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(re);
  return match ? match[1].trim() : "";
}

function formatDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;

    const now = Date.now();
    const diff = now - d.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return null;
  }
}
