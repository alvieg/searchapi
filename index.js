// SearchAPI.js
import { load } from "cheerio";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SearchAPI({
  delay = 1000,
  safeSearch = true,
  headers = {},
  cacheSize = 100,
  resultsPerPage = 10,
} = {}) {
  const cache = new Map();

  const defaultHeaders = { "User-Agent": "Mozilla/5.0", ...headers };

  // Caching helper
  function addToCache(url, text) {
    if (cache.size >= cacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(url, text);
  }

  async function cachedFetch(url) {
    if (cache.has(url)) return cache.get(url);
    const res = await fetch(url, { headers: defaultHeaders });
    if (!res.ok)
      throw new Error(`Fetch error: ${res.status} ${res.statusText}`);
    const text = await res.text();
    addToCache(url, text);
    return text;
  }

  function decodeDDGLink(url) {
    try {
      const parsed = new URL(url, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      return uddg ? decodeURIComponent(uddg) : url;
    } catch {
      return url;
    }
  }

  // Text search
  async function text(query, pages = 1, maxResults = 20) {
    const results = [];
    for (let page = 0; page < pages; page++) {
      const start = page * resultsPerPage;
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        query
      )}&s=${start}${safeSearch ? "&kp=1" : ""}`;

      let html;
      try {
        html = await cachedFetch(url);
      } catch (err) {
        console.warn("Failed fetching DuckDuckGo HTML:", err.message);
        continue;
      }

      const $ = load(html);
      $("div.result").each((_, el) => {
        try {
          const titleEl = $(el).find("a.result__a");
          const snippetEl = $(el).find(".result__snippet");
          if (titleEl.length) {
            let link = decodeDDGLink(titleEl.attr("href") || "");
            results.push({
              title: titleEl.text(),
              link,
              snippet: snippetEl.text(),
            });
          }
        } catch (err) {
          console.warn("Failed parsing result:", err.message);
        }
      });

      await sleep(delay + Math.random() * 200); // adaptive delay

      if (results.length >= maxResults) break;
    }

    return results.slice(0, maxResults);
  }

  // Instant answer
  async function instant(query) {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
        query
      )}&format=json&no_html=1${safeSearch ? "&kp=1" : ""}`;
      const res = await fetch(url, { headers: defaultHeaders });
      if (!res.ok)
        throw new Error(
          `Instant answer error: ${res.status} ${res.statusText}`
        );
      const data = await res.json();
      return {
        heading: data.Heading,
        answer: data.AbstractText || data.Answer || null,
        url: data.AbstractURL || null,
        type: data.Type,
      };
    } catch (err) {
      console.warn("Instant answer failed:", err.message);
      return null;
    }
  }

  // Wikipedia summary
  async function wiki(query) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        query
      )}`;
      const res = await fetch(url, { headers: defaultHeaders });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        title: data.title,
        extract: data.extract,
        url: data.content_urls?.desktop?.page || null,
        thumbnail: data.thumbnail?.source || null,
      };
    } catch (err) {
      console.warn("Wikipedia fetch failed:", err.message);
      return null;
    }
  }

  // Full search
  async function search(query, maxResults = 20, pages = 1) {
    const [textResults, instantResults, wikiResults] = await Promise.all([
      text(query, pages, maxResults),
      instant(query),
      wiki(query),
    ]);

    return { text: textResults, instant: instantResults, wiki: wikiResults };
  }

  return { text, instant, wiki, search };
}
