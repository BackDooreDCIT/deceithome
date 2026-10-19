export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function on(target, type, handler, opts) {
  target.addEventListener(type, handler, opts);
  return () => target.removeEventListener(type, handler, opts);
}

export function debounce(fn, wait) {
  let timer = null;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  }
  debounced.flush = (...args) => { clearTimeout(timer); fn(...args); };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function deepGet(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function deepSet(obj, path, value) {
  const keys = path.split('.');
  let node = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
    node = node[k];
  }
  node[keys[keys.length - 1]] = value;
  return obj;
}

export function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (typeof target[k] !== 'object' || target[k] === null || Array.isArray(target[k])) target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

export function hashColor(str, buckets = 12) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % buckets;
}
