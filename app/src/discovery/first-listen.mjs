/** One honest first-listen action at each point in discovery. No playback
 * and no preference changes occur merely from rendering this guide.
 */
export function firstListenAction({hasTrack=false,loading=false,error=''}={}) {
  if(hasTrack)return {
    action:'first-listen-play',
    label:'Play My First Preview',
    help:'A recording is ready. Press Play to hear it, then choose Keep or Pass on the card.',
    disabled:false
  };
  if(loading)return {
    action:'load-more',
    label:'Finding Your First Song…',
    help:'Checking the music provider for a playable recording. No choices have been recorded.',
    disabled:true
  };
  if(error)return {
    action:'load-more',
    label:'Retry Finding Music',
    help:'The music provider could not load a recording. Try again or pick a different listening path. Your choices stay safe.',
    disabled:false
  };
  return {
    action:'load-more',
    label:'Find My First Song',
    help:'Search for a playable recording. Nothing is added to your listening history until you choose Keep or Pass.',
    disabled:false
  };
}
