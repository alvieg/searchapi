// ddgWrapper.js
import { load } from "cheerio";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SearchAPI({ delay = 1000, safeSearch = true } = {}) {
  const cache = new Map();

  // Helper: fetch with caching
  async function cachedFetch(url) {
    if (cache.has(url)) return cache.get(url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok)
      throw new Error(`Fetch error: ${res.status} ${res.statusText}`);
    const text = await res.text();
    cache.set(url, text);
    return text;
  }

  // Helper: decode DDG redirect URLs
  function decodeDDGLink(url) {
    try {
      const parsed = new URL(url, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) return decodeURIComponent(uddg);
      return url;
    } catch {
      return url;
    }
  }

  // Text search
  async function text(query, pages = 1, maxResults = 20) {
    const results = [];
    for (let page = 0; page < pages; page++) {
      const start = page * 10;
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        query
      )}&s=${start}${safeSearch ? "&kp=1" : ""}`;

      const html = await cachedFetch(url);
      const $ = load(html);

      $("div.result").each((_, el) => {
        const titleEl = $(el).find("a.result__a");
        const snippetEl = $(el).find(".result__snippet");
        if (titleEl.length) {
          let link = titleEl.attr("href") || "";
          link = decodeDDGLink(link); // decode redirect
          results.push({
            title: titleEl.text(),
            link,
            snippet: snippetEl.text(),
          });
        }
      });

      await sleep(delay);
      if (results.length >= maxResults) break;
    }

    return results.slice(0, maxResults);
  }

  // Instant answer
  async function instant(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_html=1${safeSearch ? "&kp=1" : ""}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok)
      throw new Error(`Instant answer error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return {
      heading: data.Heading,
      answer: data.AbstractText || data.Answer || null,
      url: data.AbstractURL || null,
      type: data.Type,
    };
  }

  // Wikipedia summary
  async function wiki(query) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok)
      throw new Error(`Wikipedia error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page || null,
      thumbnail: data.thumbnail?.source || null,
    };
  }

  return { text, instant, wiki };
}
