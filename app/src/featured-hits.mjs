/**
 * Carefully attributed official videos whose IDs were individually checked
 * against YouTube / artists' official music pages in November 2026.
 * This finite starter lane works without the YouTube Data API search key.
 * Videos are presented ONLY via the standard, visible YouTube embed;
 * no audio ripping, stream caching, ad blocking or deceptive cover art.
 * An artist/record-label upload is the provenance being claimed, not an
 * independent guarantee of future availability or region access.
 */
import { validGenre } from './live-commons.mjs';

// [video id, artist, song, genre, language, decade, uploader]
export const FEATURED_VIDEOS = Object.freeze([
 ['CwfoyVa980U','Charlie Puth','How Long','pop','en','2010s','Charlie Puth'],
 ['UqyT8IEBkvY','Bruno Mars','24K Magic','pop','en','2010s','Bruno Mars'],
 ['QYh6mYIJG2Y','Ariana Grande','7 rings','pop','en','2010s','Ariana Grande'],
 ['TUVcZfQe-Kw','Dua Lipa','Levitating (feat. DaBaby)','pop','en','2020s','Dua Lipa'],
 ['JGwWNGJdvx8','Ed Sheeran','Shape of You','pop','en','2010s','Ed Sheeran'],
 ['K0ibBPhiaG0','Ed Sheeran','Castle on the Hill','pop','en','2010s','Ed Sheeran'],
 ['2Vv-BfVoq4g','Ed Sheeran','Perfect','pop','en','2010s','Ed Sheeran'],
 ['87gWaABqGYs','Ed Sheeran','Galway Girl','folk','en','2010s','Ed Sheeran'],
 ['iWZmdoY1aTE','Ed Sheeran','Happier','pop','en','2010s','Ed Sheeran'],
 ['4NRXx6U8ABQ','The Weeknd','Blinding Lights','pop','en','2020s','The Weeknd'],
 ['nfWlot6h_JM','Taylor Swift','Shake It Off','pop','en','2010s','Taylor Swift'],
 ['2vjPBrBU-TM','Sia','Chandelier','pop','en','2010s','Sia'],
 ['09R8_2nJtjg','Maroon 5','Sugar','pop','en','2010s','Maroon 5'],
 ['DyDfgMOUjCI','Billie Eilish','bad guy','pop','en','2010s','Billie Eilish'],
 ['gdZLi9oWNZg','BTS','Dynamite','pop','en','2020s','HYBE LABELS'],
 ['WMweEpGlu_U','BTS','Butter','pop','en','2020s','HYBE LABELS'],
 ['dQw4w9WgXcQ','Rick Astley','Never Gonna Give You Up','pop','en','1980s','Rick Astley'],
 ['6Mgqbai3fKo','Shakira','Chantaje (feat. Maluma)','pop','es','2010s','Shakira'],
 ['kJQP7kiw5Fk','Luis Fonsi','Despacito (feat. Daddy Yankee)','pop','es','2010s','Luis Fonsi'],
 ['IHNzOHi8sJs','BLACKPINK','DDU-DU DDU-DU','pop','ko','2010s','BLACKPINK'],
 ['MBdVXkSdhwU','BTS','DNA','pop','ko','2010s','HYBE LABELS'],
 ['9bZkp7q19f0','PSY','Gangnam Style','pop','ko','2010s','officialpsy'],
]);

export function featuredTrack(row) {
  const [id,artist,title,genre,language,era,uploader] = row;
  return {
    id:`youtube:${id}`, source:'youtube', title, artist, uploader, genre, language, era, mood:'Fresh',
    tags:[], originalCandidate:true, verifiedSeed:true,
    artwork:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    link:`https://www.youtube.com/watch?v=${id}`,
    license:'YouTube official artist/label video, viewed in the standard embedded player. Ads may appear.',
  };
}
const ALL = Object.freeze([...new Map(FEATURED_VIDEOS.map(row => [row[0], featuredTrack(row)])).values()]);

/** Explicit page numbers rather than dynamically injecting unknown video IDs. */
export function fetchFeaturedPage(genre = 'all', cursor = '0', query = '', language = 'all', era = 'any') {
  genre = validGenre(genre);
  const page = /^(0|[1-9]\d{0,3})$/.test(String(cursor)) ? Number(cursor) : 0;
  const text = String(query || '').trim().toLocaleLowerCase();
  const filtered = ALL.filter(track =>
    (genre === 'all' || track.genre === genre) &&
    (era === 'any' || track.era === era) &&
    (language === 'all' || (language === 'en' ? track.language === 'en' : track.language === (language === 'en-strict' ? 'en' : language))) &&
    (!text || `${track.artist} ${track.title}`.toLocaleLowerCase().includes(text))
  );
  const PAGE_SIZE = 12;
  const start = page * PAGE_SIZE;
  const tracks = filtered.slice(start, start + PAGE_SIZE);
  const hasMore = start + PAGE_SIZE < filtered.length;
  return {
    tracks, provider:'featured', hasMore, nextCursor:hasMore ? String(page + 1) : null,
    total:filtered.length,
    note:'Hand-picked, attributed mainstream songs. This small starter selection works without an API key; configure YouTube search to discover beyond it. YouTube ads and embedding restrictions still apply.',
  };
}
