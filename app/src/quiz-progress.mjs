/** Tune Lab uses the same verified-write principle as listening progress.
 * Never count an answer or reveal success until the stored score reads back. */
export const QUIZ_STORAGE_KEY='aftertone:tune-lab:v1';
const empty=()=>({answered:0,correct:0});
const valid=stats=>Boolean(stats && Number.isSafeInteger(stats.answered) &&
  Number.isSafeInteger(stats.correct) && stats.answered>=0 &&
  stats.answered<=1_000_000 && stats.correct>=0 && stats.correct<=stats.answered);
export function loadQuizStats(storage) {
  try {
    const value=JSON.parse(storage.getItem(QUIZ_STORAGE_KEY)||'null');
    // Accept older numeric-string counters as the original loader did,
    // but never permit fractional, nonfinite or impossible scores.
    const stats={answered:Number(value?.answered??0),correct:Number(value?.correct??0)};
    return valid(stats)?stats:empty();
  } catch {return empty();}
}
export function nextQuizStats(stats,correct) {
  if(!valid(stats)||typeof correct!=='boolean'||stats.answered>=1_000_000)return null;
  return {answered:stats.answered+1,correct:stats.correct+(correct?1:0)};
}
export function saveQuizStats(storage,stats) {
  if(!valid(stats))return false;
  const serialized=JSON.stringify({answered:stats.answered,correct:stats.correct});
  try {
    storage.setItem(QUIZ_STORAGE_KEY,serialized);
    return storage.getItem(QUIZ_STORAGE_KEY)===serialized;
  }catch{return false;}
}
