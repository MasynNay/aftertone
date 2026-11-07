/**
 * Optional Discovery Passport quests. All progress is derived from actual
 * persisted listening decisions or Tune Lab answers; no invented scores.
 * We do not count auto-advanced previews as a decision.
 */
export function getPassportProgress(history = [], quizStats = {}) {
  const events = Array.isArray(history) ? history : [];
  const kept = events.filter(event => event?.action === 'like');
  const distinctArtists = new Set(kept.map(event => String(event.artist || '').trim().toLocaleLowerCase()).filter(Boolean));
  const wildcardDecisions = events.filter(event => event?.context !== 'search' && event?.route === 'explore' && ['like','pass'].includes(event.action)).length;
  const answered = Math.max(0, Number(quizStats.answered) || 0);
  const definitions = [
    { id:'spark', title:'First sparks', detail:'Keep three songs worth returning to', goal:3, value:new Set(kept.map(event=>event.id)).size, action:'discover', actionLabel:'Keep exploring' },
    { id:'voices', title:'New voices', detail:'Keep songs from five different artists', goal:5, value:distinctArtists.size, action:'balanced', actionLabel:'Find new artists' },
    { id:'orbit', title:'Off the map', detail:'Rate seven songs in Wild Card', goal:7, value:wildcardDecisions, action:'explore', actionLabel:'Go Wild Card' },
    { id:'ear', title:'Sharp ears', detail:'Answer five questions in Tune Lab', goal:5, value:answered, action:'quiz', actionLabel:'Open Tune Lab' },
  ];
  return {
    quests: definitions.map(quest=>({ ...quest, progress:Math.min(quest.goal,quest.value), completed:quest.value>=quest.goal })),
    earned: definitions.filter(quest=>quest.value>=quest.goal).length,
    total:definitions.length,
  };
}
