/** Presentation-only helpers shared by the templates and browser controller. */
export const SPECTRUM = [
  ['#6682bb', '#293155'], ['#bf8f9c', '#4c2c4d'], ['#52968c', '#233c4e'],
  ['#be9c65', '#6b5237'], ['#9d9bc9', '#414267'], ['#9a6aa9', '#39254e'],
];

export const html = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;
export const clamp = (value, a, b) => Math.max(a, Math.min(value, b));
export const urlSafe = (link) => {
  if (/^\/api\/jellyfin-art\?id=[a-f0-9]{32}$/i.test(link || '')) return html(link);
  try { const url = new URL(link); return url.protocol === 'https:' ? html(url.href) : '#'; }
  catch { return '#'; }
};
export const h32 = (string) => [...string].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
export const shade = (id) => SPECTRUM[h32(id) % SPECTRUM.length];
export const tag = (text) => `<span class="tag">${html(text)}</span>`;
