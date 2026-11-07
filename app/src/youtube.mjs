/**
 * YouTube music discovery. The Data API provides metadata; playback remains
 * exclusively in YouTube's visible, official embedded player.
 *
 * We deliberately search for named, established artists instead of broad
 * 'music' queries. Broad searches predominantly returned covers, compilations,
 * AI instrumentals, and other material the listener was not seeking.
 */
import { validGenre } from './live-commons.mjs';
import { readable, parsedCredit, candidateOfficialYouTube, likelyMusicRecording, trackLanguage, matchesLanguage, uploaderMatchesArtist } from './recording-quality.mjs';

const API = 'https://www.googleapis.com/youtube/v3';
const SEARCH_ENDPOINT = `${API}/search`;
const VIDEOS_ENDPOINT = `${API}/videos`;

// These are discovery starting points, NOT a claim that these recordings are
// licensed for audio extraction or that all channel uploads are original.
// Intentionally span decades, genres and languages; additional pages can be
// requested without storing a fixed audio catalog.
const SEEDS = Object.freeze({
  pop: [
    ['Taylor Swift','en'],['Charlie Puth','en'],['Dua Lipa','en'],['Ariana Grande','en'],['The Weeknd','en'],['Bruno Mars','en'],
    ['Billie Eilish','en'],['Olivia Rodrigo','en'],['Harry Styles','en'],['Sabrina Carpenter','en'],['Adele','en'],['Lady Gaga','en'],
    ['Rihanna','en'],['Katy Perry','en'],['Justin Bieber','en'],['Ed Sheeran','en'],['Michael Jackson','en'],['Madonna','en'],
    ['Shakira','es'],['Bad Bunny','es'],['ROSALÍA','es'],['Karol G','es'],['Enrique Iglesias','es'],['Anitta','pt'],
    ['BTS','ko'],['BLACKPINK','ko'],['TWICE','ko'],['NewJeans','ko'],['YOASOBI','ja'],['Ado','ja'],
    ['Arijit Singh','hi'],['Diljit Dosanjh','hi'],['Stromae','fr'],['Angèle','fr'],['Rammstein','de'],
  ],
  rock: [
    ['Queen','en'],['The Beatles','en'],['Nirvana','en'],['Foo Fighters','en'],['Linkin Park','en'],['Paramore','en'],
    ['Green Day','en'],['Coldplay','en'],['Muse','en'],['The Killers','en'],['Arctic Monkeys','en'],['Imagine Dragons','en'],
    ['Red Hot Chili Peppers','en'],['Metallica','en'],['Bon Jovi','en'],['Evanescence','en'],['One OK Rock','ja'],['Måneskin','it'],
    ['Soda Stereo','es'],['Rammstein','de'],
  ],
  indie: [
    ['Lana Del Rey','en'],['Tame Impala','en'],['The 1975','en'],['Twenty One Pilots','en'],['Cage the Elephant','en'],
    ['Florence and the Machine','en'],['The Neighbourhood','en'],['Glass Animals','en'],['Cigarettes After Sex','en'],
    ['Vampire Weekend','en'],['Clairo','en'],['Hozier','en'],['Mitski','en'],['Mac DeMarco','en'],
  ],
  electronic: [
    ['Daft Punk','en'],['Avicii','en'],['Calvin Harris','en'],['David Guetta','en'],['Zedd','en'],['Marshmello','en'],
    ['The Chainsmokers','en'],['Skrillex','en'],['Kygo','en'],['Martin Garrix','en'],['Swedish House Mafia','en'],
    ['Alan Walker','en'],['Disclosure','en'],['Clean Bandit','en'],['Kraftwerk','de'],
  ],
  hiphop: [
    ['Kendrick Lamar','en'],['Drake','en'],['Eminem','en'],['Post Malone','en'],['SZA','en'],['Doja Cat','en'],
    ['Nicki Minaj','en'],['Travis Scott','en'],['Tyler the Creator','en'],['J Cole','en'],['Cardi B','en'],['Missy Elliott','en'],
    ['Outkast','en'],['50 Cent','en'],['J Balvin','es'],['Daddy Yankee','es'],
  ],
  ambient: [['M83','en'],['Tycho','en'],['ODESZA','en'],['Bonobo','en'],['Brian Eno','en'],['Nils Frahm','de'],['Ryuichi Sakamoto','ja']],
  jazz: [['Norah Jones','en'],['Diana Krall','en'],['Amy Winehouse','en'],['Michael Bublé','en'],['Gregory Porter','en'],['Esperanza Spalding','en'],['Laufey','en']],
  funk: [['Stevie Wonder','en'],['Earth Wind and Fire','en'],['Prince','en'],['Anderson Paak','en'],['Janelle Monáe','en'],['Silk Sonic','en'],['Jamiroquai','en']],
  folk: [['Noah Kahan','en'],['Mumford and Sons','en'],['The Lumineers','en'],['Vance Joy','en'],['Zach Bryan','en'],['Kacey Musgraves','en'],['Of Monsters and Men','en']],
  cinematic: [['Hans Zimmer','instrumental'],['John Williams','instrumental'],['Joe Hisaishi','instrumental'],['Ludwig Göransson','instrumental'],['Ramin Djawadi','instrumental']],
  classical: [['Ludovico Einaudi','instrumental'],['Yo-Yo Ma','instrumental'],['Lang Lang','instrumental'],['Hilary Hahn','instrumental'],['André Rieu','instrumental']],
});
const GLOBAL = [
  ['Shakira','es','pop'],['Bad Bunny','es','pop'],['ROSALÍA','es','pop'],['Karol G','es','pop'],['J Balvin','es','hiphop'],
  ['Anitta','pt','pop'],['BTS','ko','pop'],['BLACKPINK','ko','pop'],['TWICE','ko','pop'],['YOASOBI','ja','pop'],
  ['Ado','ja','pop'],['Arijit Singh','hi','pop'],['Diljit Dosanjh','hi','pop'],['Stromae','fr','pop'],['Angèle','fr','pop'],
  ['Rammstein','de','rock'],['Måneskin','it','rock'],['Soda Stereo','es','rock'],
];
const ENGLISH_MIX = [
  ['Taylor Swift','pop'],['Charlie Puth','pop'],['Dua Lipa','pop'],['Billie Eilish','pop'],['Bruno Mars','pop'],
  ['Rihanna','pop'],['Ariana Grande','pop'],['Michael Jackson','pop'],['Paramore','rock'],['Coldplay','rock'],
  ['Nirvana','rock'],['Linkin Park','rock'],['Queen','rock'],['Green Day','rock'],['The Killers','rock'],
  ['Kendrick Lamar','hiphop'],['Drake','hiphop'],['Eminem','hiphop'],['SZA','hiphop'],['Doja Cat','hiphop'],
  ['Daft Punk','electronic'],['Calvin Harris','electronic'],['Avicii','electronic'],['Lana Del Rey','indie'],
  ['Tame Impala','indie'],['Hozier','indie'],['Stevie Wonder','funk'],['Amy Winehouse','jazz'],
  ['Noah Kahan','folk'],['John Williams','cinematic'],
].map(([artist,genre]) => [artist,'en',genre]);

const asLane = ([artist, language, genre]) => ({ artist, language, genre, query: `${artist} official music video` });
export function seedLanes(genre = 'all', language = 'all', era = 'any') {
  genre = validGenre(genre);
  let seeds = genre === 'all' ? [...ENGLISH_MIX, ...GLOBAL] : (SEEDS[genre] || SEEDS.pop).map(([a,l]) => [a,l,genre]);
  if (language === 'en' || language === 'en-strict') seeds = seeds.filter((s) => s[1] === 'en' || s[1] === 'instrumental');
  else if (language !== 'all') seeds = seeds.filter((s) => s[1] === language || s[1] === 'instrumental');
  // When the specific genre has no curated artist for a requested language,
  // search it generically rather than silently returning empty results.
  // Truly global browsing should show non-English artists throughout the
  // session, not only after dozens of English-only search pages.
  if (language === 'all') {
    const english = seeds.filter(([, lang]) => lang === 'en' || lang === 'instrumental');
    const world = seeds.filter(([, lang]) => lang !== 'en' && lang !== 'instrumental');
    const mixed = [];
    while (english.length || world.length) {
      for (let i=0; i<2 && english.length; i++) mixed.push(english.shift());
      if (world.length) mixed.push(world.shift());
    }
    seeds = mixed;
  }
  if (!seeds.length) {
    const langName = {es:'Spanish',fr:'French',pt:'Portuguese',de:'German',it:'Italian',ja:'Japanese',ko:'Korean',zh:'Chinese',hi:'Hindi',ar:'Arabic',ru:'Russian'}[language] || '';
    return [{ artist:'', language, genre, query: `${langName} ${genre === 'all' ? 'popular' : genre} songs official music video ${era !== 'any' ? era : ''}`.trim() }];
  }
  // Distribute eras naturally rather than forcing decade constraints onto new
  // artists, which would return covers or unrelated compilations.
  if (era !== 'any') return [{ artist:'', language, genre, query: `${era} ${genre === 'all' ? 'hit songs' : genre} official music video` }, ...seeds.map(s => ({ ...asLane(s), query: `${s[0]} ${era} official music video` }))];
  return seeds.map(asLane);
}
export const YOUTUBE_SEARCH_LANES = Object.freeze(Object.fromEntries(Object.keys(SEEDS).concat('all').map((genre) =>
  [genre, Object.freeze(seedLanes(genre).map((lane) => lane.query))])));

export function parseYouTubeCursor(cursor = '', search = '') {
  if (!cursor) return { lane: 0, token: '' };
  if (search) {
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(cursor)) throw new Error('Invalid YouTube page cursor');
    return { lane: 0, token: cursor };
  }
  const composite = /^s(\d{1,3})~([A-Za-z0-9_-]{0,180})$/.exec(cursor);
  if (composite) { const lane = Number(composite[1]); if (lane >= 250) throw new Error('Invalid YouTube page cursor'); return { lane, token: composite[2] }; }
  if (/^[A-Za-z0-9_-]{1,180}$/.test(cursor)) return { lane: 0, token: cursor };
  throw new Error('Invalid YouTube page cursor');
}
const simplify = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180);
export function isYouTubeId(id) { return /^[A-Za-z0-9_-]{11}$/.test(String(id || '')); }
export function configuredYouTubeKey(env = process.env) {
  const value = env.YOUTUBE_API_KEY?.trim() || '';
  return /^[A-Za-z0-9_-]{20,200}$/.test(value) ? value : '';
}
function matchesSearchWords(track, query) {
  const normalized = (v) => readable(v).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const words = normalized(query).split(' ').filter(Boolean).filter((word)=> !['official','video','music','song','audio'].includes(word));
  const identity = normalized(`${track.artist} ${track.title}`);
  // A title search such as 'How Long' must still work; otherwise searching a
  // specific artist could accidentally return unrelated videos from a hot chart.
  return words.every(word => identity.includes(word));
}
function seconds(duration) {
  const match = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(duration || '');
  return match ? Number(match[1] || 0)*3600 + Number(match[2] || 0)*60 + Number(match[3] || 0) : null;
}
export function normalizeYouTubeVideo(item, genre = 'all', checkProvenance = true, details = null, options = {}) {
  const id = item?.id?.videoId || item?.id;
  const snippet = item?.snippet;
  if (!isYouTubeId(id) || !snippet || !simplify(snippet.title) ||
      !likelyMusicRecording({title:snippet.title, description:snippet.description, duration: details?.contentDetails ? seconds(details.contentDetails.duration) : null}) ||
      (details?.status?.embeddable === false) || details?.status?.privacyStatus === 'private' ||
      snippet.liveBroadcastContent === 'live') return null;
  const rawTitle = readable(snippet.title);
  const channel = readable(snippet.channelTitle || 'YouTube Music');
  const originalCandidate = candidateOfficialYouTube({ title: rawTitle, channel });
  if (checkProvenance && !originalCandidate) return null;
  // Generic query results often include OTHER artists even when sorted by
  // popularity. For named-artist lanes demand channel/artist agreement with
  // the target, not merely a video tagged as 'official'.
  if (options.expectedArtist && !uploaderMatchesArtist(options.expectedArtist, channel)) return null;
  const parsed = parsedCredit(rawTitle);
  const artist = parsed.creditedArtist || channel.replace(/(?:VEVO|\s*-\s*Topic|\s*Official)$/i, '').trim();
  const title = parsed.title;
  const art = snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url;
  const views = Number(details?.statistics?.viewCount);
  if (options.hitsOnly && !options.explicitSearch && Number.isFinite(views) && details?.statistics?.viewCount !== undefined && views < 100000) return null;
  return {
    id: `youtube:${id}`, title, artist, genre: genre === 'all' ? (options.laneGenre || 'pop') : validGenre(genre),
    mood: 'Fresh', tags: [], source: 'youtube', uploader: channel, originalCandidate,
    language: trackLanguage({ language:details?.snippet?.defaultAudioLanguage || '', title:snippet.title }),
    metadataLanguage: trackLanguage({ language:details?.snippet?.defaultLanguage || '', title:snippet.title }),
    views: Number.isFinite(views) && details?.statistics?.viewCount !== undefined ? views : null,
    artwork: typeof art === 'string' && /^https:\/\//.test(art) ? art : null,
    link: `https://www.youtube.com/watch?v=${id}`,
    license: 'Video hosted by YouTube. Embedded player may show ads. Channel attribution is the uploader.',
  };
}

async function apiJson(fetcher, url) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(14000), headers: {Accept:'application/json'} });
  if (!response.ok) {
    if (response.status === 403) throw new Error('YouTube search quota exhausted or API access denied. Try later or select another provider.');
    throw new Error(`YouTube API returned HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error('YouTube returned an invalid response');
  return data;
}

export async function fetchYouTubePage(genre = 'all', cursor = '', fetcher = fetch, key = '', search = '', checkProvenance = true, language = 'all', era = 'any', discovery = 'hits', expectedArtist = '') {
  if (!configuredYouTubeKey({ YOUTUBE_API_KEY: key })) throw new Error('YouTube is not configured. Add a YouTube Data API key to your local .env file.');
  genre = validGenre(genre);
  const lanes = seedLanes(genre, language, era);
  const { lane, token } = parseYouTubeCursor(cursor, search);
  if (lane >= lanes.length) throw new Error('Invalid YouTube page cursor');
  const explicitSearch = Boolean(simplify(search));
  const picked = explicitSearch ? { query: simplify(search) } : lanes[lane];
  const url = new URL(SEARCH_ENDPOINT);
  url.search = new URLSearchParams({
    key, part:'snippet', type:'video', maxResults:'50', videoEmbeddable:'true', videoCategoryId:'10',
    order: discovery === 'hits' ? 'viewCount' : 'relevance',
    ...(language === 'en' || language === 'en-strict' ? {relevanceLanguage:'en'} :
       language !== 'all' ? {relevanceLanguage:language} : {}),
    q: picked.query.slice(0, 90), ...(token ? {pageToken:token} : {}),
  }).toString();
  const data = await apiJson(fetcher, url);
  const ids = [...new Set(data.items.map((item) => item?.id?.videoId).filter(isYouTubeId))];
  let detailMap = new Map();
  if (ids.length) {
    // Search responses cannot tell us the language spoken in the default audio
    // track, nor the duration or view count. videos.list can expose these when
    // supplied by uploaders, for a small additional API request.
    const detailUrl = new URL(VIDEOS_ENDPOINT);
    detailUrl.search = new URLSearchParams({ key, part:'snippet,contentDetails,statistics,status', id: ids.join(',') }).toString();
    try {
      const detailData = await apiJson(fetcher, detailUrl);
      detailMap = new Map(detailData.items.filter((entry) => typeof entry?.id === 'string').map((entry) => [entry.id, entry]));
    } catch (error) {
      // Audio language and popularity then remain unknown. The user can still
      // browse title/channel-matched results; never manufacture an English tag.
      if (error?.name === 'AbortError' || !['all','en'].includes(language)) throw new Error(`Audio-language metadata was unavailable: ${error.message}`);
    }
  }
  const tracks = [...new Map(data.items.map((item) => {
    const id = item?.id?.videoId;
    return normalizeYouTubeVideo(item, genre, checkProvenance, detailMap.get(id), {
      hitsOnly: discovery === 'hits', explicitSearch, laneGenre:picked.genre, expectedArtist: explicitSearch ? expectedArtist : picked.artist,
    });
  }).filter((track) => track && matchesLanguage(track, language) && (!explicitSearch || matchesSearchWords(track, search))).map((track) => [track.id, track])).values()];
  // Rank actual verified-volume recordings first, without preferring a
  // nonofficial channel solely because it purchased or received more views.
  if (discovery === 'hits') tracks.sort((a,b) => (b.views || 0) - (a.views || 0));
  // One artist's most popular uploads should not monopolize the entire queue.
  // A manual title/artist search is never artificially limited this way.
  if (!explicitSearch && tracks.length > 6) tracks.length = 6;
  const pageToken = typeof data.nextPageToken === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(data.nextPageToken) ? data.nextPageToken : '';
  // Two pages at most per artist before moving to a different artist.
  // This avoids a feed containing 40 songs by the same singer while keeping
  // manual artist/song searches fully pageable.
  const nextCursor = explicitSearch ? (pageToken || null)
    : pageToken && !token ? `s${lane}~${pageToken}`
    : lane + 1 < lanes.length ? `s${lane+1}~` : null;
  return { tracks, nextCursor, hasMore:Boolean(nextCursor), provider:'youtube',
    note:'Artist-focused discovery across genres and languages. YouTube search and video-details API quota applies. Audio is played only in YouTube\'s visible player.' };
}
/** Enforce a short clip in the official, visible YouTube player. */
export function youtubeEmbedUrl(id, startSeconds = 30, clipSeconds = 22) {
  if (!isYouTubeId(id)) return null;
  const start = Math.max(0, Math.floor(startSeconds));
  const end = start + Math.max(1, Math.min(120, Math.floor(clipSeconds)));
  return `https://www.youtube.com/embed/${id}?start=${start}&end=${end}&playsinline=1&autoplay=1`;
}
