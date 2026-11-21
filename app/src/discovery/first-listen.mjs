/** One honest first-listen action at each point in discovery. No playback
 * and no preference changes occur merely from rendering this guide.
 */
export function firstListenAction({hasTrack=false,loading=false,error=''}={}) {
  if(hasTrack)return {
    action:'first-listen-play',
    label:'Play My First Preview',
    help:'A recording is ready. Listen, then Keep or Pass. If the audio fails, Retry Preview or Skip Without Voting.',
    disabled:false
  };
  if(loading)return {
    action:null,
    label:'Finding Your First Song…',
    help:'Checking the music provider for a playable recording. No choices have been recorded.',
    disabled:true
  };
  if(error)return {
    action:null,
    label:'Music Is Unavailable',
    help:'The provider could not find a song. Use Retry Discovery below or change your listening path. No choices were lost.',
    disabled:false
  };
  return {
    action:null,
    label:'Ready to Find Your First Song',
    help:'Use Find More Songs below, or choose another listening path. Nothing is rated until you choose Keep or Pass.',
    disabled:false
  };
}
