/** Quiz generation intentionally uses catalog metadata, never unlicensed lyric text. */
export function makeRecognitionQuiz(track, catalog, random = Math.random) {
  const field = track.artist === 'Wikimedia Commons contributor' ? 'title' : random() > 0.5 ? 'title' : 'artist';
  const label = field === 'artist' ? 'Who made this track?' : 'What is the name of this track?';
  const correct = track[field];
  const decoys = [...new Set(catalog.filter((entry) => entry.id !== track.id).map((entry) => entry[field]))]
    .filter((value) => value !== correct);
  // Shuffle decoys with injected randomness and rotate the correct placement.
  for (let i = decoys.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [decoys[i], decoys[j]] = [decoys[j], decoys[i]];
  }
  const options = [correct, ...decoys.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { field, label, correct, options };
}
