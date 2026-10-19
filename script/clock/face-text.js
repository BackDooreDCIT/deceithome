let el = null;
let formatter = null;
let formatterKey = '';

function getFormatter(opts) {
  const key = `${opts.hour12 ? '12' : '24'}|${opts.showSeconds ? 's' : ''}`;
  if (key !== formatterKey) {
    formatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: opts.showSeconds ? '2-digit' : undefined,
      hour12: opts.hour12
    });
    formatterKey = key;
  }
  return formatter;
}

function mount(root) {
  el = document.createElement('div');
  root.appendChild(el);
  formatterKey = '';
  return { w: 0, h: 0 };
}

function update(d, opts) {
  el.textContent = getFormatter(opts).format(d);
}

function unmount() {
  el = null;
  formatter = null;
  formatterKey = '';
}

export default { id: 'text', wantsRaf: false, mount, update, unmount };
