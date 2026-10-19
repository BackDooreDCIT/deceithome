export function isLikelyUrl(str) {
  if (!str) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(str)) return true;                       // scheme://
  if (/^localhost(?:\:\d+)?(?:[\/?#].*)?$/i.test(str)) return true;            // localhost
  if (/^\d{1,3}(\.\d{1,3}){3}(?::\d+)?(?:[\/?#].*)?$/i.test(str)) return true; // IPv4
  if (/^[\w-]+(\.[\w-]+)+(?::\d+)?(?:[\/?#].*)?$/i.test(str) && !/\s/.test(str)) return true; // domain.tld
  return false;
}

export const hasScheme = (s) => /^[a-z][a-z0-9+.-]*:\/\//i.test(s);

export const normalizeUrl = (s) => (hasScheme(s) ? s : 'https://' + s);

export function normalizeForDedupe(url) {
  try {
    const u = new URL(hasScheme(url) ? url : 'https://' + url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/$/, '');
    return `${host}${path}`;
  } catch {
    return String(url || '').toLowerCase();
  }
}
