(() => {
  const form  = document.querySelector('.search-container form');
  const input = document.getElementById('search-input');
  if (!form || !input) return;

  function isLikelyUrl(str) {
    if (!str) return false;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(str)) return true;                 // scheme://
    if (/^localhost(?:\:\d+)?(?:[\/?#].*)?$/i.test(str)) return true;      // localhost
    if (/^\d{1,3}(\.\d{1,3}){3}(?::\d+)?(?:[\/?#].*)?$/i.test(str)) return true; // IPv4
    if (/^[\w-]+(\.[\w-]+)+(?::\d+)?(?:[\/?#].*)?$/i.test(str) && !/\s/.test(str)) return true; // domain.tld
    return false;
  }
  const hasScheme   = s => /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
  const normalizeUrl = s => hasScheme(s) ? s : 'https://' + s;

  // add/remove style based on url detection
  function updateInputStyle() {
    const raw = (input.value || '').trim();
    input.classList.toggle('is-url', isLikelyUrl(raw));
  }
  input.addEventListener('input', updateInputStyle);
  updateInputStyle();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = (input.value || '').trim();
    if (!raw) return;

    if (isLikelyUrl(raw)) {
      window.location.assign(normalizeUrl(raw));
    } else {
      window.location.assign('https://www.google.com/search?q=' + encodeURIComponent(raw));
    }
  });

  // Optional: Ctrl/Cmd+Enter opens in a new tab
//   form.addEventListener('keydown', (e) => {
//     if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
//       e.preventDefault();
//       const raw = (input.value || '').trim();
//       if (!raw) return;
//       const href = isLikelyUrl(raw)
//         ? normalizeUrl(raw)
//         : 'https://www.google.com/search?q=' + encodeURIComponent(raw);
//       window.open(href, '_blank', 'noopener');
//     }
//   });
})();
