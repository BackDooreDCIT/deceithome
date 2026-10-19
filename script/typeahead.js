const NAV_KEYS = new Set([
  'Tab', 'Escape', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'Backspace', 'CapsLock', 'ContextMenu',
  'Shift', 'Control', 'Alt', 'Meta', ' '
]);
const EDITABLE = 'input, textarea, select, button, a[href], [contenteditable=""], [contenteditable="true"], [tabindex]';

function shouldRedirect(e, input) {
  if (e.defaultPrevented) return false;
  if (e.isComposing || e.keyCode === 229) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (NAV_KEYS.has(e.key)) return false;
  if (e.key.length !== 1) return false;
  if (e.repeat) return false;

  const active = document.activeElement;
  if (active === input) return false;
  if (active && active !== document.body && active.closest(EDITABLE)) return false;

  const classes = document.documentElement.classList;
  if (classes.contains('panel-open') || classes.contains('sidebar-open') || classes.contains('dialog-open')) return false;

  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && String(sel).length) return false;

  return true;
}

export function init() {
  const input = document.getElementById('search-input');
  if (!input) return;
  window.addEventListener('keydown', (e) => {
    if (!shouldRedirect(e, input)) return;
    input.focus({ preventScroll: true });
    // No preventDefault: Chrome delivers the subsequent keypress to the
    // newly-focused element, so the character lands in the input.
  }, { passive: true });
}
