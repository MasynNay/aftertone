/** Keep challenges tiny, deterministic, and free of personal listening history. */
export function encodeChallenge(ids) {
  const cleaned = [...new Set(ids)].filter((id) => /^(commons|jamendo|audius):[\w-]+$/.test(id)).slice(0, 5);
  if (cleaned.length === 0) return '';
  return `v1.${cleaned.join('~')}`;
}

export function decodeChallenge(value) {
  if (typeof value !== 'string' || value.length > 256 || !value.startsWith('v1.')) return [];
  const ids = value.slice(3).split('~');
  if (ids.length < 1 || ids.length > 5 || ids.some((id) => !/^(commons|jamendo|audius):[\w-]+$/.test(id))) return [];
  return [...new Set(ids)];
}
