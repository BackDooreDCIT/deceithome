export const ENGINES = {
  google: {
    search: 'https://www.google.com/search?q=%s',
    suggest: 'https://suggestqueries.google.com/complete/search?client=chrome&q=%s',
    origin: 'https://suggestqueries.google.com/*'
  },
  duckduckgo: {
    search: 'https://duckduckgo.com/?q=%s',
    suggest: 'https://duckduckgo.com/ac/?q=%s&type=list',
    origin: 'https://duckduckgo.com/*'
  },
  bing: {
    search: 'https://www.bing.com/search?q=%s',
    suggest: 'https://api.bing.com/osjson.aspx?query=%s',
    origin: 'https://api.bing.com/*'
  },
  custom: { search: '', suggest: '', origin: null }
};

function fillTemplate(tpl, q) {
  return tpl.replace('%s', encodeURIComponent(q));
}

export function buildSearchUrl(prefs, q) {
  const engineKey = prefs?.search?.engine || 'google';
  let tpl = engineKey === 'custom' ? prefs.search.customSearchUrl : ENGINES[engineKey]?.search;
  if (!tpl || !tpl.includes('%s')) tpl = ENGINES.google.search;
  return fillTemplate(tpl, q);
}

export function buildSuggestUrl(prefs, q) {
  const engineKey = prefs?.search?.engine || 'google';
  let tpl = engineKey === 'custom' ? prefs.search.customSuggestUrl : ENGINES[engineKey]?.suggest;
  if (!tpl || !tpl.includes('%s')) return null;
  return fillTemplate(tpl, q);
}

export function parseSuggest(json) {
  return Array.isArray(json) && Array.isArray(json[1])
    ? json[1].filter((s) => typeof s === 'string').slice(0, 10)
    : [];
}
