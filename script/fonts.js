const loaded = new Set(['Lexend', 'Roboto Mono', 'System']);

export function ensureFont(family) {
  if (!family || loaded.has(family)) return;
  loaded.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family='
    + encodeURIComponent(family).replace(/%20/g, '+')
    + ':wght@300;400;500;700&display=swap';
  document.head.appendChild(link);
}
