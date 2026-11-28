/** Read-only overview of the entire saved library, with browse-only
 * quick filters that remain a fast path to the existing Collection selects.
 */
import {collectionSearchKey} from '/src/collection-pagination.mjs';
import {html} from './view-utils.js';

export function renderCollectionInsights(insights,{genre='all',mood='all'}={}) {
  if(!insights?.saved)return '';
  const group=(kind,label,options,selected)=>options.length?`<div class="collection-insights-group">
    <span>${label}</span><div class="collection-insights-chips" role="group" aria-label="${label}">
      ${options.map(f=>{
        const active=collectionSearchKey(selected)===collectionSearchKey(f.value);
        return `<button type="button" data-action="collection-quick-filter"
          data-filter-kind="${kind}" data-filter-value="${html(f.value)}"
          aria-pressed="${active}" class="collection-insights-chip ${active?'is-selected':''}"
          aria-label="${kind==='genre'?'Filter genre':'Filter mood'}: ${html(f.value)}, ${f.count} saved ${f.count===1?'song':'songs'}">${html(f.value)} <small>${f.count}</small></button>`;
      }).join('')}
    </div></div>`:'';
  return `<section class="collection-insights" aria-label="Your Collection at a glance">
    <div class="collection-insights-head"><strong>YOUR SOUND, AT A GLANCE</strong><span>Based on your full saved library</span></div>
    <div class="collection-insights-metrics">
      <div><strong>${insights.saved}</strong><span>Saved songs</span></div>
      <div><strong>${insights.artists}</strong><span>Artists</span></div>
      <div><strong>${insights.genres}</strong><span>Genres</span></div>
      <div><strong>${insights.moods}</strong><span>Moods</span></div>
    </div>
    ${insights.missing?`<p class="collection-insights-note" role="status">${insights.missing} saved ${insights.missing===1?'song ID lacks':'song IDs lack'} track details in this browser. These IDs remain in your backups, but cannot appear as cards until metadata becomes available.</p>`:''}
    <div class="collection-insights-shortcuts">
      ${group('genre','Explore genres',insights.topGenres,genre)}
      ${group('mood','Explore moods',insights.topMoods,mood)}
    </div>
  </section>`;
}
