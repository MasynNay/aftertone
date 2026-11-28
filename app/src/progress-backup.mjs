/** Versioned, local-only export and restore of AFTERTONE's core progress.
 * No audio is downloaded. Imports are untrusted files: validate completely
 * before changing browser storage and roll back if any storage write fails.
 */
import {STORAGE_KEY,loadState,sanitizeState} from './persistence.mjs';
import {DUEL_STORAGE_KEY,loadDuelStore,DUEL_MAX_ARCHIVES} from './duels.mjs';
import {parseFavoriteArtists} from './discovery-personalization.mjs';
import {parsePlaylist,trackIdentity} from './playlist-import.mjs';
import {MAX_HISTORY,MAX_FAVORITE_IDS,MAX_SAVED_TRACKS as MAX_TRACKS} from './collection-capacity.mjs';
import {PLAYLIST_STORAGE_KEY as PLAYLIST_KEY,ARTISTS_STORAGE_KEY as ARTISTS_KEY,MAX_SAVED_PLAYLIST_TRACKS as MAX_PLAYLIST_TRACKS} from './personalization-store.mjs';

import {validatePersonalPlaylists} from './personal-playlists.mjs';

export const BACKUP_FORMAT='aftertone-progress';
export const BACKUP_VERSION=2;
export const BACKUP_MAX_BYTES=4_000_000;
const QUIZ_KEY='aftertone:tune-lab:v1';
const LYRIC_OFFSETS_KEY='aftertone:lyric-offsets:v1';
const MAX_LYRIC_OFFSETS=200;


function boundedCount(value,label) {
  if (!Number.isSafeInteger(value) || value<0 || value>1_000_000)
    throw new Error('Invalid '+label+' in backup.');
  return value;
}
/** A backup must never silently export empty defaults for damaged local data.
 * The running app may recover defensively for display; an archival export must
 * instead preserve evidence that the stored record could not be recovered.
 */
function readValidatedLocalJSON(storage,key,label,empty,validate) {
  const raw=storage.getItem(key);
  if(raw===null) return empty; // A genuinely fresh browser is not corrupt.
  try {return validate(JSON.parse(raw));}
  catch {
    throw new Error(label+' data in this browser is damaged; backup was not created. Existing saved data was not changed.');
  }
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
     !Array.isArray(raw.favorites) || raw.favorites.length>MAX_FAVORITE_IDS ||
     !Array.isArray(raw.savedTracks) || raw.savedTracks.length>MAX_TRACKS)
    throw new Error('Backup has an unsupported or malformed listening session.');
  if(Object.hasOwn(raw,'personalPlaylists'))validatePersonalPlaylists(raw.personalPlaylists);
  const normalized=sanitizeState(raw);
  if(normalized.history.length!==raw.history.length ||
     normalized.favorites.length!==raw.favorites.length ||
     normalized.savedTracks.length!==raw.savedTracks.length)
    throw new Error('Backup contains invalid, duplicate, or unsupported tracks.');
  // Only retain the recordChoice fields. Arbitrary keys from imported JSON
  // must not become persistent UI or recommendation state.
  normalized.history=normalized.history.map(event=>({
    id:event.id,action:event.action,genre:event.genre,artist:event.artist,
    ...(event.alreadySaved===true?{alreadySaved:true}:{}),
    ...(typeof event.title==='string'&&event.title.trim()?{title:event.title.trim().slice(0,180)}:{}),
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
      !Array.isArray(t.entries) || t.entries.some(e=>!e || typeof e.title!=='string' ||
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
  const session=readValidatedLocalJSON(storage,STORAGE_KEY,'Listening progress',
    loadState(storage),raw=>safeSession(
      // Early v1 sessions predate savedTracks; only *absent* is a valid legacy value.
      raw && typeof raw==='object' && !Array.isArray(raw) &&
      !Object.hasOwn(raw,'savedTracks') ? {...raw,savedTracks:[]} : raw));
  const tournaments=readValidatedLocalJSON(storage,DUEL_STORAGE_KEY,'Music Duels',
    [],raw=>{
      if(raw?.version!==1 || !Array.isArray(raw.tournaments))
        throw new Error('Invalid tournament store');
      return safeDuels(raw.tournaments);
    });
  const quiz=readValidatedLocalJSON(storage,QUIZ_KEY,'Tune Lab',
    {answered:0,correct:0},raw=>{
      if(!raw || typeof raw!=='object' || Array.isArray(raw))
        throw new Error('Invalid quiz store');
      return safeQuiz({
        answered:Number(raw.answered ?? 0),
        correct:Number(raw.correct ?? 0),
      });
    });
  const artists=readValidatedLocalJSON(storage,ARTISTS_KEY,'Favorite artists',
    [],safeArtists);
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
  // Early v1 backup sessions legitimately predate savedTracks. Migrate only
  // an ABSENT field in an authenticated v1 format, never a null, wrong-type,
  // malformed, or missing field in a current v2 backup. We cannot invent
  // lost song names or previews; original favorite IDs are retained.
  const legacyNoTrackMetadata=input.version===1 && input.session &&
    typeof input.session==='object' && !Array.isArray(input.session) &&
    !Object.hasOwn(input.session,'savedTracks');
  const session=safeSession(legacyNoTrackMetadata
    ? {...input.session,savedTracks:[]} : input.session);
  const metadataIds=new Set(session.savedTracks.map(track=>track.id));
  const missingFavoriteMetadata=session.favorites.filter(id=>!metadataIds.has(id)).length;
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
      quizAnswered:quiz.answered,
      quizCorrect:quiz.correct,
      playlistTracks:isV2?(playlist?.tracks.length??0):null,
      lyricOffsets:isV2?Object.keys(lyricOffsets).length:null,
      version:input.version,
      ...(session.personalPlaylists?.length?{personalPlaylists:session.personalPlaylists.length,personalPlaylistSongs:session.personalPlaylists.reduce((n,p)=>n+p.trackIds.length,0)}:{}),
      // Legacy files may preserve favorite identities without track titles;
      // communicate this rather than promising visible restored song cards.
      ...(missingFavoriteMetadata ? {missingFavoriteMetadata} : {}),
    },
  };
}

/** Build an honest, read-only restore comparison for the confirmation dialog.
 * Restores replace the complete supported profile rather than merging it.
 * A v1 backup deliberately leaves newer playlist/lyric keys unchanged.
 */
export function compareProgressSummaries(current,incoming) {
  if(!current || !incoming)throw new Error('Both progress summaries are required.');
  const fields=[
    ['favorites','Saved songs'],
    ['decisions','Listening choices'],
    ['tournaments','Music Duels tournaments'],
    ['artists','Favorite artists'],
    ['quizAnswered','Tune Lab answers'],
    ['quizCorrect','Correct Tune Lab answers'],
    ['playlistTracks','Imported playlist songs'],
    ['lyricOffsets','Lyric timing adjustments'],
  ];
  if(current.personalPlaylists||incoming.personalPlaylists){
    fields.push(['personalPlaylists','Personal playlists'],['personalPlaylistSongs','Personal playlist memberships']);
    current={personalPlaylists:0,personalPlaylistSongs:0,...current};
    incoming={personalPlaylists:0,personalPlaylistSongs:0,...incoming};
  }
  const lines=[],reductions=[];
  for(const [key,label] of fields) {
    const before=current[key],after=incoming[key];
    if(after===null) {
      lines.push(label+': unchanged (not included in this older backup)');
      continue;
    }
    if(!Number.isSafeInteger(after) || after<0)
      throw new Error('Invalid incoming '+label+' count.');
    if(!Number.isSafeInteger(before) || before<0) {
      lines.push(label+': '+after+' in backup (current count unavailable)');
      continue;
    }
    const delta=after-before;
    lines.push(label+': '+before+' → '+after+' ('+(delta>0?'+':'')+delta+')');
    if(delta<0)reductions.push(label);
  }
  return {lines,reductions};
}

/** Compare actual identities from validated restore plans, not merely totals.
 * Only counts are exposed to the dialog. Older plans omit optional keys, so
 * an absent key never becomes an invented deletion. No storage writes. */
export function compareProgressContents(current,incoming) {
  const plan=inspected=>{
    if(!Array.isArray(inspected?.writes))throw new Error('Validated restore plans are required.');
    return new Map(inspected.writes.map(([key,value])=>[key,value===null?null:JSON.parse(value)]));
  };
  const before=plan(current),after=plan(incoming);
  const old=before.get(STORAGE_KEY),next=after.get(STORAGE_KEY);
  if(!old||!next)throw new Error('Validated listening sessions are required.');
  const changes=[];
  const add=(label,count)=>{if(count>0)changes.push({label,count});};
  const missing=(a,b)=>{const other=new Set(b);return new Set(a.filter(id=>!other.has(id))).size;};
  const oldLists=old.personalPlaylists||[],nextLists=next.personalPlaylists||[];
  const nextById=new Map(nextLists.map(p=>[p.id,p]));
  add('Personal playlists absent from backup',missing(oldLists.map(p=>p.id),nextLists.map(p=>p.id)));
  add('Personal playlist memberships absent from backup',oldLists.reduce((n,p)=>n+missing(p.trackIds,nextById.get(p.id)?.trackIds||[]),0));
  add('Personal playlists renamed in backup',oldLists.filter(p=>nextById.has(p.id)&&nextById.get(p.id).name!==p.name).length);
  const nextFavorites=new Set(next.favorites);
  add('Saved songs absent from backup',missing(old.favorites,next.favorites));
  const oldMetadata=new Set(old.savedTracks.map(t=>t.id)),nextMetadata=new Set(next.savedTracks.map(t=>t.id));
  add('Retained favorites losing song details',old.favorites.filter(id=>nextFavorites.has(id)&&oldMetadata.has(id)&&!nextMetadata.has(id)).length);
  const choices=new Map(next.history.map(e=>[e.id,e.action]));
  add('Listening choices absent from backup',missing(old.history.map(e=>e.id),next.history.map(e=>e.id)));
  add('Listening choices changing Keep/Pass',new Set(old.history.filter(e=>choices.has(e.id)&&choices.get(e.id)!==e.action).map(e=>e.id)).size);
  const oldDuels=before.get(DUEL_STORAGE_KEY)?.tournaments||[],nextDuels=after.get(DUEL_STORAGE_KEY)?.tournaments||[];
  add('Tournaments absent from backup',missing(oldDuels.map(t=>t.id),nextDuels.map(t=>t.id)));
  const artistKey=name=>name.normalize('NFKD').replace(/\p{M}/gu,'').trim().toLowerCase();
  add('Favorite artists absent from backup',missing((before.get(ARTISTS_KEY)||[]).map(artistKey),(after.get(ARTISTS_KEY)||[]).map(artistKey)));
  if(after.has(PLAYLIST_KEY)) {
    const ids=playlist=>(playlist?.tracks||[]).map(t=>trackIdentity(t.artist,t.title));
    add('Imported playlist songs absent from backup',missing(ids(before.get(PLAYLIST_KEY)),ids(after.get(PLAYLIST_KEY))));
  }
  if(after.has(LYRIC_OFFSETS_KEY)) {
    const oldOffsets=before.get(LYRIC_OFFSETS_KEY)||{},nextOffsets=after.get(LYRIC_OFFSETS_KEY)||{};
    add('Lyric timing adjustments absent from backup',missing(Object.keys(oldOffsets),Object.keys(nextOffsets)));
    add('Lyric timing adjustments changing value',Object.keys(oldOffsets).filter(id=>Object.hasOwn(nextOffsets,id)&&oldOffsets[id]!==nextOffsets[id]).length);
  }
  return changes;
}

/** Verify writes: some storage wrappers can silently drop a write rather than
 * throwing. A restore must never tell the listener it succeeded in that case.
 */
function writeAndVerify(storage,key,value) {
  if(value===null)storage.removeItem(key);
  else storage.setItem(key,value);
  if(storage.getItem(key)!==value)
    throw new Error('Browser storage did not retain the requested value.');
}

/** All-or-rollback localStorage transaction. Browser reload hydrates new data. */
export function restoreProgressBackup(storage,text) {
  const {writes,summary}=inspectProgressBackup(text);
  // Snapshot before any mutation, so a failed storage read cannot replace data.
  const previous=writes.map(([key])=>[key,storage.getItem(key)]);
  try {
    for(const [key,value] of writes) writeAndVerify(storage,key,value);
  }catch {
    let rolledBack=true;
    for(const [key,value] of previous.reverse()) {
      try {writeAndVerify(storage,key,value);}
      catch {rolledBack=false;}
    }
    throw new Error(rolledBack
      ? 'Browser storage rejected the backup. Your previous data was restored.'
      : 'Browser storage failed and rollback was incomplete. Check your saved data before continuing.');
  }
  return summary;
}
