/** Versioned, local-only export and restore of AFTERTONE's core progress.
 * No audio is downloaded. Imports are untrusted files: validate completely
 * before changing browser storage and roll back if any storage write fails.
 */
import {STORAGE_KEY,loadState,sanitizeState} from './persistence.mjs';
import {DUEL_STORAGE_KEY,loadDuelStore,DUEL_MAX_ARCHIVES} from './duels.mjs';
import {parseFavoriteArtists} from './discovery-personalization.mjs';

export const BACKUP_FORMAT='aftertone-progress';
export const BACKUP_VERSION=1;
export const BACKUP_MAX_BYTES=4_000_000;
const QUIZ_KEY='aftertone:tune-lab:v1';
const ARTISTS_KEY='aftertone:favorite-artists:v1';
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

/** Generate a portable JSON text file for saved music, choices and duels. */
export function createProgressBackup(storage,exportedAt=new Date().toISOString()) {
  const session=loadState(storage);
  const tournaments=loadDuelStore(storage);
  const rawQuiz=readJSON(storage,QUIZ_KEY,{answered:0,correct:0});
  const rawArtists=readJSON(storage,ARTISTS_KEY,[]);
  const quiz=safeQuiz({answered:Number(rawQuiz?.answered)||0,correct:Number(rawQuiz?.correct)||0});
  const artists=parseFavoriteArtists(rawArtists);
  const data=JSON.stringify({
    format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt,
    session,tournaments,quiz,artists,
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
  if(!input || input.format!==BACKUP_FORMAT || input.version!==BACKUP_VERSION)
    throw new Error('This is not a supported AFTERTONE progress backup.');
  if(typeof input.exportedAt!=='string' || !Number.isFinite(Date.parse(input.exportedAt)))
    throw new Error('Backup creation date is invalid.');
  const session=safeSession(input.session);
  const tournaments=safeDuels(input.tournaments);
  const quiz=safeQuiz(input.quiz);
  const artists=safeArtists(input.artists);
  return {
    writes:[
      [STORAGE_KEY,JSON.stringify(session)],
      [DUEL_STORAGE_KEY,JSON.stringify({version:1,tournaments})],
      [QUIZ_KEY,JSON.stringify(quiz)],
      [ARTISTS_KEY,JSON.stringify(artists)],
    ],
    summary:{
      favorites:session.favorites.length,
      decisions:session.history.length,
      tournaments:tournaments.length,
      artists:artists.length,
    },
  };
}

/** All-or-rollback localStorage transaction. Browser reload hydrates new data. */
export function restoreProgressBackup(storage,text) {
  const {writes,summary}=inspectProgressBackup(text);
  const previous=writes.map(([key])=>[key,storage.getItem(key)]);
  try {
    for(const [key,value] of writes)storage.setItem(key,value);
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
