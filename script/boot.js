import * as settings from './settings.js';
import { applyAll } from './apply.js';
import { init as initSearch } from './search.js';
import { init as initTypeahead } from './typeahead.js';
import { init as initPanel } from './panel.js';

async function boot() {
  let state;
  try {
    state = await settings.init();
  } catch {
    state = settings.get();
  }

  try {
    applyAll(state);
  } catch {
    // A corrupt/partial state must never brick the new tab into a blank page.
  }

  initSearch();
  initTypeahead();
  initPanel();

  settings.subscribe((next) => {
    try { applyAll(next); } catch { /* ignore a bad live update */ }
  });

  document.documentElement.classList.add('ready');
}

const readyFallback = setTimeout(() => {
  document.documentElement.classList.add('ready');
}, 250);

boot().finally(() => clearTimeout(readyFallback));

window.addEventListener('visibilitychange', () => {
  if (document.hidden) settings.flush();
});
