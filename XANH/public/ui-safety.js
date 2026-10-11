/** Small allow-list helpers for values coming from CMS/API before they are put in HTML attributes. */
export function safeHref(value, fallback = '/') {
  const raw = String(value ?? '').trim();
  if (!raw || /[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    try {
      const parsed = new URL(raw, 'https://xanh.invalid');
      return parsed.origin === 'https://xanh.invalid' ? raw : fallback;
    } catch { return fallback; }
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname && !parsed.username && !parsed.password) return parsed.href;
    } catch { /* use fallback below */ }
  }
  if (/^mailto:[^\s<>]+$/i.test(raw)) return raw;
  if (/^tel:[+0-9().\- ]+$/i.test(raw)) return raw;
  if (/^#[A-Za-z][\w:.-]*$/.test(raw)) return raw;
  return fallback;
}

export function safeImageSrc(value, fallback = '/assets/xanh-sky-first-logo.png') {
  const raw = String(value ?? '').trim();
  if (!raw || /[\u0000-\u001f\u007f\\"'<>`(){}]/.test(raw)) return fallback;
  if (raw.startsWith('/assets/')) {
    if (!raw.includes('..') && !raw.includes('//') && !/["'<>`()]/.test(raw)) return raw;
    return fallback;
  }
  if (/^\/api\/media\/\d+$/.test(raw)) return raw;
  if (/^https:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'https:' && parsed.hostname === 'images.unsplash.com' && !parsed.username && !parsed.password) return parsed.href;
    } catch { /* use fallback below */ }
  }
  return fallback;
}

export function isInternalHref(value) {
  const href = safeHref(value, '');
  return href.startsWith('/') && !href.startsWith('//');
}
