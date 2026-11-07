/**
 * Best-effort music metadata cleanup and provenance checks.
 * Important: uploader/title agreement is NOT verification of rights or identity.
 * Never turn a cover into an apparent original by rewriting its artist credit.
 */
const BAD_TITLE = /\b(?:karaoke|remix(?:ed)?|bootleg|mashup|nightcore|sped[ -]?up|slowed(?:\s*(?:\+|and|&)\s*reverb)?|parody|tribute|fan[ -]?made|unofficial|reaction|tutorial|type[ -]?beat|re[ -]?record(?:ing|ed)?|8d[ -]?audio|instrumental[ -]?version)\b/i;
const COVER_MARKER = /(?:[([\-–—]\s*(?:a\s+)?cover\b|\bcover\s+(?:of|by|version|song)\b|\b(?:acoustic|piano|guitar)\s+cover\b|\bcover\s*[)\]]\s*$)/i;
const EXPLICIT_COVER = /(?:\b(?:i\s+)?cover(?:ed)?\s+(?:of|by|from)\b|\boriginally\s+(?:performed|sung|recorded)\s+by\b|\b(?:my|this)\s+cover\b|\btribute\s+to\b|\bkaraoke\b|\bremix\s+of\b)/i;
const TRAILING = /\s*[\[(]\s*(?:official\s+(?:music\s+)?video|official\s+audio|lyric(?:s)?\s+video|visualizer|audio\s+only|hq\s+audio|4k\s+video|hd\s+video)\s*[\])]\s*/gi;
const WORDS = /[\p{L}\p{N}]+/gu;

export function readable(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
    .replace(/_/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}
export function displayTitle(value) {
  const raw = readable(value).replace(/\.(?:mp3|wav|flac|m4a)$/i, '').replace(TRAILING, ' ').trim();
  return raw.replace(/\s+/g, ' ').replace(/\s+[-–—]\s*$/, '').trim();
}
export function parsedCredit(rawTitle) {
  const title = displayTitle(rawTitle);
  const match = title.match(/^(.{2,80}?)\s+[-–—]\s+(.{2,})$/u);
  if (!match) return { title, creditedArtist: null };
  // The first term is a probable artist credit, not automatically a fact.
  return { title: displayTitle(match[2]), creditedArtist: readable(match[1]) };
}
export function canonicalArtist(value) {
  const cleaned = readable(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*(?:-\s*topic|official\s*(?:artist\s*)?channel|official)$/i, '')
    .replace(/vevo$/i, '').toLowerCase().replace(/^the\s+/, '');
  return [...cleaned.matchAll(WORDS)].map(m => m[0]).join('');
}
export function uploaderMatchesArtist(credit, uploader) {
  const who = canonicalArtist(uploader);
  if (!who || !credit) return false;
  const components = readable(credit).split(/\s+(?:feat\.?|featuring|ft\.?|and|with|x)\s+|\s*[,&+]\s*/i);
  return components.some((part) => who === canonicalArtist(part));
}
export function looksLikeCoverOrEdit(title, extraText = '') {
  return BAD_TITLE.test(readable(title)) || COVER_MARKER.test(readable(title)) || EXPLICIT_COVER.test(readable(extraText));
}
export function candidateOriginalFromUpload({ title, uploader, description = '', tags = '', remixOf = null }) {
  if (!title || !uploader || looksLikeCoverOrEdit(title, `${tags} ${description}`) || remixOf) return false;
  const parsed = parsedCredit(title);
  // When an uploader explicitly claims another artist's credit, do not silently
  // represent that upload as a recording by the credited artist.
  if (parsed.creditedArtist && !uploaderMatchesArtist(parsed.creditedArtist, uploader)) return false;
  return true;
}
export function candidateOfficialYouTube({ title, channel }) {
  if (!candidateOriginalFromUpload({ title, uploader: channel })) return false;
  const { creditedArtist } = parsedCredit(title);
  // This checks metadata agreement, NOT a YouTube verified badge. In particular
  // the Data API cannot prove that a channel impersonating an artist is official.
  if (creditedArtist) return uploaderMatchesArtist(creditedArtist, channel);
  return /(?:vevo\s*$|\s-\s*topic\s*$)/i.test(channel) || /\bofficial\s+(?:music\s+)?(?:video|audio)\b/i.test(title);
}


// Avoid spoken-word, samples, ad jingles and uploads that are not finished songs.
// This is deliberately conservative: do not throw away independent artists just
// because a track has a small play count or lacks a verified badge.
const NOT_SONG = /\b(?:podcast|interview|audiobook|chapter\s+\d+|episode\s*#?\d+|spoken[ -]?word|speech|sermon|prayer recording|lecture|tutorial|reaction|review|unboxing|news report|radio show|talk show|livestream|live stream|compilation|full album|full playlist|playlist mix|top \d+ songs|sound effects?|sfx|sample pack|drum loop|loop pack|type beat|free beat|beat for sale|instrumental remake|karaoke|acapella isolated|vocal isolated|white noise|brown noise|pink noise|rain sounds?|nature sounds?|asmr|meditation guide|guided meditation|advertisement|commercial break|jingle|ringtone|test tone|mic test|sound test|phone call|voicemail|demo reel|behind the scenes|trailer|preview trailer)\b/i;
const NON_ENGLISH = /\b(?:spanish|español|français|french|italiano|italian|deutsch|german|português|portuguese|japanese|nihongo|korean|hangul|mandarin|chinese|russian|arabic|hindi|turkish|persian|vietnamese|polish|swahili)\s+(?:lyrics?|song|version|vocal|music|audio)\b/i;
const LANGUAGE_TAG = /(?:^|[\s,;#|])(?:lang(?:uage)?[:=_ -]+)([a-z]{2,3})(?=$|[\s,;#|])/i;
const LETTERS_OUTSIDE_LATIN = /[\u0400-\u052f\u0600-\u06ff\u0900-\u097f\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;
export function likelyMusicRecording({title = '', description = '', tags = '', duration = null, kind = ''} = {}) {
  if (!title) return false;
  const heading = readable(title);
  const labels = Array.isArray(tags) ? tags.join(' ') : String(tags || '');
  // Titles and tags are much more dependable than verbose descriptions that
  // can mention interviews or podcasts while describing an actual song.
  if (NOT_SONG.test(`${heading} ${labels}`)) return false;
  if (/\b(?:podcast|audiobook|spoken[ -]?word|speech|lecture|sound effect|sfx|asmr)\b/i.test(kind)) return false;
  if (Number.isFinite(Number(duration)) && duration != null && (Number(duration) < 45 || Number(duration) > 900)) return false;
  if (/\b(?:this (?:is|was) an interview|this episode features|welcome to (?:my|the) podcast)\b/i.test(String(description).slice(0,250))) return false;
  return true;
}
export function trackLanguage({language = '', tags = '', title = '', description = ''} = {}) {
  const direct = String(language || '').toLowerCase().trim().split(/[_-]/)[0];
  if (/^[a-z]{2,3}$/.test(direct)) return direct === 'eng' ? 'en' : direct;
  const label = Array.isArray(tags) ? tags.join(' ') : String(tags || '');
  const found = label.match(LANGUAGE_TAG);
  if (found) return found[1] === 'eng' ? 'en' : found[1];
  // A non-Latin title strongly signals a different-language vocal recording;
  // do not guess the language of the audio just from an English song title.
  if (LETTERS_OUTSIDE_LATIN.test(readable(title)) || NON_ENGLISH.test(`${title} ${label}`)) return 'other';
  return 'unknown';
}
export function matchesLanguage(track, selected = 'all') {
  if (selected === 'all') return true;
  if (selected === 'en-strict') return track.language === 'en';
  if (selected === 'instrumental') return track.vocal === 'instrumental';
  if (selected === 'en') return true; // Preference affects ranking/search lanes, not eligibility.
  return track.language === selected;
}
