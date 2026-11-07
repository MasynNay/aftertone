/** Shared playback-level rules for Discover, Collection, and Music Duels.
 *
 * Volume is an integer percentage saved alongside the existing v1 state.
 * Keep mute separate from level: toggling mute must not destroy the user's
 * last comfortable volume. Any explicitly selected nonzero level unmutes.
 */
export const DEFAULT_VOLUME = 35;

export function normalizeVolume(value, fallback = DEFAULT_VOLUME) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback;
}

export function updateVolumeSetting(state, value) {
  const volume = normalizeVolume(value);
  return { ...state, volume, sound: volume > 0 };
}

export function toggleMuteSetting(state) {
  const sound = !state.sound;
  // After sliding to zero, the first Unmute action restores a safe level.
  return { ...state, sound, volume: sound && normalizeVolume(state.volume) === 0 ? DEFAULT_VOLUME : normalizeVolume(state.volume) };
}

export function actualVolume(state) {
  return state.sound && normalizeVolume(state.volume) > 0 ? normalizeVolume(state.volume) / 100 : 0;
}
