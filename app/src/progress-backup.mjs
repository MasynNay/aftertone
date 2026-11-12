/** Versioned, local-only export and restore of AFTERTONE's core progress.
 * No audio is downloaded. Imports are untrusted files: validate completely
 * before changing browser storage and roll back if any storage write fails.
 */
import {STORAGE_KEY,loadState,sanitizeState} from './persistence.mjs';
import {DUEL_STORAGE_KEY,loadDuelStore,DUEL_MAX_ARCHIVES} from './duels.mjs';
import {parseFavoriteArtists} from './discovery-personalization.mjs';
import {parsePlaylist} from './playlist-import.mjs';

export const BACKUP_FORMAT='aftertone-progress';
export const BACKUP_VERSION=2;
export const BACKUP_MAX_BYTES=4_000_000;
const QUIZ_KEY='aftertone:tune-lab:v1';
const ARTISTS_KEY='aftertone:favorite-artists:v1';
const PLAYLIST_KEY='aftertone:optional-playlist:v1';
const LYRIC_OFFSETS_KEY='aftertone:lyric-offsets:v1';
const MAX_PLAYLIST_TRACKS=3000;
const MAX_LYRIC_OFFSETS=200;
const MAX_HISTORY=5000;
const MAX_TRACKS=1500;

function boundedCount(value,label) {
  if (!Number.isSafeInteger(value) || value<0 || value>1_000_000)
    throw new Error('Invalid '+label+' in backup.');
  return value;
}
function readJSON(storage,key,fallback) {
  try {return JSON.parse(storage.getItem(key)||'null')??fallback;}
  catch {return fallback;}
}
function safeQuiz(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid Tune Lab results.');
  const answered=boundedCount(value.answered,'Tune Lab count');
  const correct=boundedCount(value.correct,'Tune Lab score');
  if(correct>answered)throw new Error('Tune Lab score exceeds answers.');
  return {answered,correct};
}
function safeArtists(value) {
  if(!Array.isArray(value) || value.length>5 || value.some(v=>typeof v!=='string' || v.length>75))
    throw new Error('Invalid favorite artists.');
  const artists=parseFavoriteArtists(value);
  if(artists.length!==value.length)throw new Error('Favorite artists contain invalid or duplicate names.');
  return artists;
}
function safeSession(raw) {
  if(!raw || typeof raw!=='object' || raw.version!==1 ||
     !Array.isArray(raw.history) || raw.history.length>MAX_HISTORY ||
     !Array.isArray(raw.favorites) || raw.favorites.length>MAX_HISTORY ||
     !Array.isArray(raw.savedTracks) || raw.savedTracks.length>MAX_TRACKS)
    throw new Error('Backup has an unsupported or malformed listening session.');
  const normalized=sanitizeState(raw);
  if(normalized.history.length!==raw.history.length ||
     normalized.favorites.length!==raw.favorites.length ||
     normalized.savedTracks.length!==raw.savedTracks.length)
    throw new Error('Backup contains invalid, duplicate, or unsupported tracks.');
  // Only retain the recordChoice fields. Arbitrary keys from imported JSON
  // must not become persistent UI or recommendation state.
  normalized.history=normalized.history.map(event=>({
    id:event.id,action:event.action,genre:event.genre,artist:event.artist,
    context:event.context,route:event.route,
    recognized:typeof event.recognized==='boolean'?event.recognized:null,
    correct:typeof event.correct==='boolean'?event.correct:null,
    mood:typeof event.mood==='string'?event.mood.slice(0,30):null,
    at:Number.isSafeInteger(event.at)&&event.at>=0?event.at:0,
  }));
  return normalized;
}
function safeDuels(value) {
  if(!Array.isArray(value) || value.length>DUEL_MAX_ARCHIVES)
    throw new Error('Backup contains too many tournaments.');
  if(value.some(t=>!t || typeof t.name!=='string' || t.name.length>80 ||
      !Array.isArray(t.entries) || t.entries.some(e=>typeof e.title!=='string' ||
      e.title.length>180 || typeof e.artist!=='string' || e.artist.length>180)))
    throw new Error('Backup contains invalid tournament metadata.');
  const stub={getItem:key=>key===DUEL_STORAGE_KEY?JSON.stringify({version:1,tournaments:value}):null};
  const loaded=loadDuelStore(stub);
  if(loaded.length!==value.length)
    throw new Error('Backup contains a damaged or unsupported tournament.');
  return loaded;
}

/**
 * Normalize an optional imported playlist using the application's existing
 * CSV/JSON parser. No audio is exported, and unknown metadata is discarded.
 */
function safePlaylist(value) {
  if(value===null) return null;
  if(!value || typeof value!=='object' || Array.isArray(value) ||
     !Array.isArray(value.tracks) || !value.tracks.length ||
     value.tracks.length>MAX_PLAYLIST_TRACKS)
    throw new Error('Backup contains an invalid imported playlist.');
  const tracks=value.tracks.map(track=>{
    if(!track || typeof track!=='object' || Array.isArray(track) ||
       typeof track.artist!=='string' || typeof track.title!=='string' ||
       !track.artist.trim() || !track.title.trim() ||
       track.artist.length>180 || track.title.length>180)
      throw new Error('Backup contains an invalid playlist entry.');
    return {artist:track.artist,title:track.title};
  });
  let parsed;
  try { parsed=parsePlaylist(JSON.stringify({tracks})); }
  catch { throw new Error('Backup contains an invalid imported playlist.'); }
  // A file that collapses invalid or duplicate rows must not silently erase
  // user data. Treat the backup as malformed instead.
  if(parsed.tracks.length!==tracks.length)
    throw new Error('Backup playlist contains unsupported or duplicate tracks.');
  return {tracks:parsed.tracks};
}

/** Bounds protect lyric position data from corrupt or adversarial backups. */
function safeLyricOffsets(value) {
  if(!value || typeof value!=='object' || Array.isArray(value))
    throw new Error('Backup contains invalid lyric timing data.');
  const pairs=Object.entries(value);
  if(pairs.length>MAX_LYRIC_OFFSETS)
    throw new Error('Backup contains too many lyric timing adjustments.');
  const sanitized=Object.create(null);
  for(const [id,seconds] of pairs) {
    if(!/^(commons|jamendo|audius|jellyfin|youtube|deezer):[\w-]{1,120}$/.test(id) ||
       typeof seconds!=='number' || !Number.isFinite(seconds) ||
       seconds<0 || seconds>86400)
      throw new Error('Backup contains an invalid lyric timing adjustment.');
    sanitized[id]=seconds;
  }
  return sanitized;
}
function readOptionalJSON(storage,key,label) {
  const raw=storage.getItem(key);
  if(raw===null) return null;
  try{return JSON.parse(raw);}
  catch {throw new Error(label+' data in this browser is damaged; backup was not created.');}
}

/** Generate a portable JSON file of all supported local progress (format v2). */
export function createProgressBackup(storage,exportedAt=new Date().toISOString()) {
  const session=loadState(storage);
  const tournaments=loadDuelStore(storage);
  const rawQuiz=readJSON(storage,QUIZ_KEY,{answered:0,correct:0});
  const rawArtists=readJSON(storage,ARTISTS_KEY,[]);
  const quiz=safeQuiz({answered:Number(rawQuiz?.answered)||0,correct:Number(rawQuiz?.correct)||0});
  const artists=parseFavoriteArtists(rawArtists);
  // The original v1 backup missed these two separately stored features.
  // Include explicit empty values so restores can replace them predictably.
  const playlist=safePlaylist(readOptionalJSON(storage,PLAYLIST_KEY,'Imported playlist'));
  const lyricOffsets=safeLyricOffsets(readOptionalJSON(storage,LYRIC_OFFSETS_KEY,'Lyric timing') ?? {});
  const data=JSON.stringify({
    format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt,
    session,tournaments,quiz,artists,playlist,lyricOffsets,
  },null,2);
  if(new TextEncoder().encode(data).length>BACKUP_MAX_BYTES)
    throw new Error('Progress is too large for this backup format.');
  return data;
}

/** Validate before displaying a destructive import confirmation. */
export function inspectProgressBackup(text) {
  if(typeof text!=='string' || new TextEncoder().encode(text).length>BACKUP_MAX_BYTES)
    throw new Error('Select an AFTERTONE JSON backup smaller than 4 MB.');
  let input;
  try {input=JSON.parse(text);}
  catch {throw new Error('This file is not valid JSON. Nothing was changed.');}
  if(!input || input.format!==BACKUP_FORMAT || ![1,BACKUP_VERSION].includes(input.version))
    throw new Error('This is not a supported AFTERTONE progress backup.');
  if(typeof input.exportedAt!=='string' || !Number.isFinite(Date.parse(input.exportedAt)))
    throw new Error('Backup creation date is invalid.');
  const session=safeSession(input.session);
  const tournaments=safeDuels(input.tournaments);
  const quiz=safeQuiz(input.quiz);
  const artists=safeArtists(input.artists);
  const isV2=input.version===BACKUP_VERSION;
  if(isV2 && (!Object.hasOwn(input,'playlist') || !Object.hasOwn(input,'lyricOffsets')))
    throw new Error('Backup is missing playlist or lyric timing data.');
  const playlist=isV2?safePlaylist(input.playlist):null;
  const lyricOffsets=isV2?safeLyricOffsets(input.lyricOffsets):null;
  const writes=[
    [STORAGE_KEY,JSON.stringify(session)],
    [DUEL_STORAGE_KEY,JSON.stringify({version:1,tournaments})],
    [QUIZ_KEY,JSON.stringify(quiz)],
    [ARTISTS_KEY,JSON.stringify(artists)],
  ];
  // Original format v1 has no optional preferences. Keep existing data
  // instead of implicitly deleting information that wasn't in that backup.
  if(isV2) {
    writes.push([PLAYLIST_KEY,playlist?JSON.stringify(playlist):null]);
    writes.push([LYRIC_OFFSETS_KEY,JSON.stringify(lyricOffsets)]);
  }
  return {
    writes,
    summary:{
      favorites:session.favorites.length,
      decisions:session.history.length,
      tournaments:tournaments.length,
      artists:artists.length,
      playlistTracks:isV2?(playlist?.tracks.length??0):null,
      lyricOffsets:isV2?Object.keys(lyricOffsets).length:null,
      version:input.version,
    },
  };
}

/** All-or-rollback localStorage transaction. Browser reload hydrates new data. */
export function restoreProgressBackup(storage,text) {
  const {writes,summary}=inspectProgressBackup(text);
  const previous=writes.map(([key])=>[key,storage.getItem(key)]);
  try {
    for(const [key,value] of writes) {
      if(value===null)storage.removeItem(key);
      else storage.setItem(key,value);
    }
  }catch {
    let rolledBack=true;
    for(const [key,value] of previous.reverse()) {
      try {if(value===null)storage.removeItem(key);else storage.setItem(key,value);}
      catch {rolledBack=false;}
    }
    throw new Error(rolledBack
      ? 'Browser storage rejected the backup. Your previous data was restored.'
      : 'Browser storage failed and rollback was incomplete. Check your saved data before continuing.');
  }
  return summary;
}
