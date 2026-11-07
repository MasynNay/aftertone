/**
 * Attribution-aware starter catalog.
 * Each filename is the exact Commons file title, not an inferred CDN URL.
 * Audio URLs are resolved by MediaWiki Imageinfo on demand to avoid hotlink assumptions.
 * Genre/mood labels are editorial suggestions for discovery, not official metadata.
 * No third-party music files are distributed with this repository.
 */
const tracks = [
  // Electronica and cinematic
  ['inf-dance', 'Dance', 'Infraction', 'electronic', 'Bright', 'Infraction - Dance (Upbeat Creative Future Pop).ogg'],
  ['inf-distant', 'Distant', 'Infraction', 'ambient', 'Dreamy', 'Infraction - Distant (Cinematic Documentary Drone style).opus'],
  ['inf-landforms', 'Landforms', 'Infraction', 'electronic', 'Focused', 'Infraction - Landforms.opus'],
  ['inf-planet', 'Planet Nine', 'Infraction', 'ambient', 'Dreamy', 'Infraction - Planet Nine.opus'],
  ['inf-sax', 'Sax Beat', 'Infraction', 'funk', 'Bright', 'Infraction - Sax Beat (Funk Retro Upbeat).opus'],
  ['inf-farmer', 'The Farmer', 'Infraction', 'folk', 'Warm', 'Infraction - The Farmer (Acoustic Folk Instrumental).opus'],
  ['inf-ai', 'A.I.', 'Infraction', 'electronic', 'Intense', 'Infraction – A.I. (Cyberpunk Energetic).opus'],
  ['inf-behind', 'Behind', 'Infraction', 'electronic', 'Intense', 'Infraction – Behind (Cyberpunk Future Electro).opus'],
  ['inf-never', 'Never Alone', 'Infraction', 'indie', 'Warm', 'Infraction – Never Alone (Acoustic Indie Folk).opus'],
  ['inf-escape', 'No Escape', 'Infraction', 'electronic', 'Intense', 'Infraction – No Escape (Cyberpunk-Dynamic-Dark-Sport style).opus'],
  // Pop, hip hop and alternative
  ['nef-addict', 'Addict', 'NEFFEX', 'hiphop', 'Intense', 'NEFFEX - Addict (Copyright Free).opus'],
  ['nef-rockstar', 'Born A Rockstar', 'NEFFEX', 'rock', 'Intense', 'NEFFEX - Born A Rockstar (Copyright Free).opus'],
  ['nef-down', "Don't Wanna Let Myself Down", 'NEFFEX', 'hiphop', 'Reflective', "NEFFEX - Don't Wanna Let Myself Down (Copyright Free).opus"],
  ['nef-dream', 'Dreaming On', 'NEFFEX', 'pop', 'Hopeful', 'NEFFEX - Dreaming On (Copyright Free).opus'],
  ['nef-fight', 'Fight Back', 'NEFFEX', 'rock', 'Intense', 'NEFFEX - Fight Back.oga'],
  ['nef-swing', 'Go Down Swinging', 'NEFFEX', 'rock', 'Intense', 'NEFFEX - Go Down Swinging (Copyright Free).opus'],
  ['nef-feel', "How's It Supposed To Feel", 'NEFFEX', 'hiphop', 'Reflective', "NEFFEX - How's It Supposed To Feel (Copyright Free).opus"],
  ['nef-hustlin', "Hustlin'", 'NEFFEX', 'hiphop', 'Bold', "NEFFEX - Hustlin' (Copyright Free).opus"],
  ['nef-breath', 'Just Breathing', 'NEFFEX', 'pop', 'Reflective', 'NEFFEX - Just Breathing (Copyright Free).opus'],
  ['nef-manifest', 'Manifest It', 'NEFFEX', 'hiphop', 'Bold', 'NEFFEX - Manifest It (Copyright Free).opus'],
  // Chill and downtempo
  ['sap-awake', 'Awake', 'Sappheiros', 'electronic', 'Dreamy', 'Sappheiros - Awake (Future Garage).opus'],
  ['sap-fading', 'Fading', 'Sappheiros', 'electronic', 'Reflective', 'Sappheiros - Fading (Remake) (Drum and Bass).opus'],
  ['sap-rain', 'Rain', 'Sappheiros', 'ambient', 'Dreamy', 'Sappheiros - Rain (Chillstep).opus'],
  ['sap-rem', 'Reminiscence', 'Sappheiros', 'ambient', 'Reflective', 'Sappheiros - Reminiscence (Chillstep).opus'],
  ['sap-universe', 'Universe', 'Sappheiros', 'ambient', 'Hopeful', 'Sappheiros - Universe.opus'],
  // Jazz and lounge
  ['shaw-reflection', 'A Moments Reflection', 'Jason Shaw', 'ambient', 'Reflective', 'A Moments Reflection.mp3'],
  ['shaw-bebop', 'Bebop 25', 'Jason Shaw', 'jazz', 'Bright', 'Audionautix-com-ccby-bebop25.mp3'],
  ['shaw-boogie', 'Boogie Woogie Bed', 'Jason Shaw', 'jazz', 'Bright', 'Audionautix-com-ccby-boogiewoogiebed.mp3'],
  ['shaw-jazz', 'Closer to Jazz', 'Jason Shaw', 'jazz', 'Warm', 'Audionautix-com-ccby-closertojazz.mp3'],
  ['shaw-groove', 'Dat Groove', 'Jason Shaw', 'funk', 'Bold', 'Audionautix-com-ccby-datgroovefulltrack.mp3'],
  ['shaw-fire', 'Line of Fire', 'Jason Shaw', 'rock', 'Intense', 'Audionautix-com-ccby-lineoffire.mp3'],
  ['shaw-rock', 'Medium Rock', 'Jason Shaw', 'rock', 'Bold', 'Audionautix-com-ccby-mediumrock.mp3'],
  ['shaw-ocean', 'Ocean Floor', 'Jason Shaw', 'ambient', 'Dreamy', 'Audionautix-com-ccby-oceanfloor.mp3'],
  ['shaw-samba', 'Sideways Samba', 'Jason Shaw', 'jazz', 'Bright', 'Audionautix-com-ccby-sidewayssamba.mp3'],
  ['shaw-smooth', 'Smooth Jazz Night', 'Jason Shaw', 'jazz', 'Warm', 'Audionautix-com-ccby-smoothjazznight.mp3'],
  // Modern score, chamber and playful instrumentation
  ['mac-blue', 'Blue Feather', 'Kevin MacLeod', 'ambient', 'Dreamy', 'Blue Feather (ISRC USUAN1100524).mp3'],
  ['mac-battle', 'Exotic Battle', 'Kevin MacLeod', 'cinematic', 'Intense', 'Exotic Battle (ISRC USUAN1100451).mp3'],
  ['mac-ghost', 'Ghost Dance', 'Kevin MacLeod', 'cinematic', 'Mysterious', 'Ghost Dance (ISRC USUAN1100573).mp3'],
  ['mac-force', 'Intended Force', 'Kevin MacLeod', 'cinematic', 'Intense', 'Intended Force (ISRC USUAN1100195).mp3'],
  ['mac-cattails', 'Cattails', 'Kevin MacLeod', 'folk', 'Warm', 'Kevin MacLeod - Cattails.mp3'],
  ['mac-meatball', 'Meatball Parade', 'Kevin MacLeod', 'funk', 'Bright', 'Meatball Parade (ISRC USUAN1500014).mp3'],
  ['mac-minstrel', 'Minstrel Guild', 'Kevin MacLeod', 'folk', 'Warm', 'Minstrel Guild (ISRC USUAN1200098).mp3'],
  ['mac-sugar', 'Sugar Plum Breakdown', 'Kevin MacLeod', 'cinematic', 'Mysterious', 'Sugar Plum Breakdown (ISRC USUAN1100624).mp3'],
  ['mac-tiny', 'Tiny Fugue', 'Kevin MacLeod', 'classical', 'Focused', 'Tiny Fugue (ISRC USUAN1100415).mp3'],
  ['mac-trio', 'Trio for Piano Violin and Viola', 'Kevin MacLeod', 'classical', 'Reflective', 'Trio for Piano Violin and Viola (ISRC USUAN1100460).mp3'],
];

/** @type {ReadonlyArray<import('./types.mjs').Track>} */
export const STARTER_TRACKS = Object.freeze(tracks.map(([id, title, artist, genre, mood, file]) => Object.freeze({
  id: `commons:${id}`, title, artist, genre, mood, file,
  tags: [genre, mood.toLowerCase()], source: 'commons',
  link: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replaceAll(' ', '_'))}`,
  artwork: null,
  license: 'See source file for license & attribution',
})));

export const GENRES = ['all', 'electronic', 'hiphop', 'rock', 'indie', 'pop', 'ambient', 'jazz', 'funk', 'folk', 'cinematic', 'classical'];

export function getStarterTrack(id) {
  return STARTER_TRACKS.find((track) => track.id === id) ?? null;
}
