const cache = new Map();

function fmt(timeZone) {
  const key = timeZone || 'local';
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone || undefined,
        hour12: false,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      f = fmt(''); // invalid/removed zone -> system, silently
    }
    cache.set(key, f);
  }
  return f;
}

export function getParts(date, timeZone) {
  if (!timeZone) {
    return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds(), ms: date.getMilliseconds() };
  }
  const p = Object.fromEntries(fmt(timeZone).formatToParts(date).map((x) => [x.type, x.value]));
  return { h: Number(p.hour) % 24, m: Number(p.minute), s: Number(p.second), ms: date.getMilliseconds() };
}

export function zoneList() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}
