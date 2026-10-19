import * as settings from './settings.js';
import * as perms from './permissions.js';
import { isLikelyUrl, normalizeUrl } from './url.js';
import { buildSuggestUrl, parseSuggest } from './engines.js';

const TOPSITES_TTL_MS = 10 * 60 * 1000;

function scoreHistoryItem(item, now) {
  const ageHours = Math.max(1, (now - item.lastVisitTime) / 3_600_000);
  return (item.visitCount || 1) / ageHours;
}

async function queryHistory(q, limit) {
  if (!(await perms.has('history'))) return [];
  try {
    const items = await chrome.history.search({ text: q, maxResults: 20, startTime: 0 });
    const now = Date.now();
    return items
      .sort((a, b) => scoreHistoryItem(b, now) - scoreHistoryItem(a, now))
      .slice(0, limit)
      .map((i) => ({ kind: 'history', title: i.title || i.url, url: i.url }));
  } catch {
    return [];
  }
}

async function queryBookmarks(q, limit) {
  if (!(await perms.has('bookmarks'))) return [];
  try {
    const items = await chrome.bookmarks.search(q);
    return items
      .filter((i) => i.url)
      .slice(0, limit)
      .map((i) => ({ kind: 'bookmark', title: i.title || i.url, url: i.url }));
  } catch {
    return [];
  }
}

async function getTopSites() {
  const { local } = settings.get();
  const cache = local.topSitesCache;
  if (cache && Date.now() - cache.fetchedAt < TOPSITES_TTL_MS) return cache.items;
  if (!(await perms.has('topSites'))) return [];
  try {
    const items = await chrome.topSites.get();
    settings.setLocal({ topSitesCache: { items, fetchedAt: Date.now() } });
    return items;
  } catch {
    return [];
  }
}

async function queryTopSites(q, limit) {
  const sites = await getTopSites();
  const needle = q.toLowerCase();
  return sites
    .filter((s) => s.title.toLowerCase().includes(needle) || s.url.toLowerCase().includes(needle))
    .slice(0, limit)
    .map((i) => ({ kind: 'topsite', title: i.title || i.url, url: i.url }));
}

export async function localSuggestions(q, prefs) {
  const s = prefs.search.suggest;
  const tasks = [];
  if (s.useHistory) tasks.push(queryHistory(q, s.maxLocal));
  if (s.useBookmarks) tasks.push(queryBookmarks(q, s.maxLocal));
  if (s.useTopSites) tasks.push(queryTopSites(q, s.maxLocal));
  const results = await Promise.allSettled(tasks);
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

export async function remoteSuggestions(q, prefs, signal) {
  const s = prefs.search.suggest;
  if (!s.remote) return [];
  const url = buildSuggestUrl(prefs, q);
  if (!url) return [];
  try {
    const origin = new URL(url).origin + '/*';
    if (!(await perms.hasHost(origin))) return [];
  } catch {
    return [];
  }
  try {
    const res = await fetch(url, { credentials: 'omit', cache: 'no-store', signal });
    const json = await res.json();
    return parseSuggest(json)
      .slice(0, s.maxRemote)
      .map((text) => ({ kind: 'query', title: text, url: null }));
  } catch {
    return [];
  }
}

function engineLabel(engine) {
  return { google: 'Google', duckduckgo: 'DuckDuckGo', bing: 'Bing', custom: 'the web' }[engine] || 'the web';
}

export function actionRow(q, prefs) {
  if (isLikelyUrl(q)) return { kind: 'action', title: `Go to ${q}`, url: normalizeUrl(q) };
  return { kind: 'action', title: `Search ${engineLabel(prefs.search.engine)} — ${q}`, url: null };
}
