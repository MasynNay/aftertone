# Music Duels — Six Arenas, Resumable Brackets, and Hall of Fame

## Player guide

1. Choose **Music Duels** in the left navigation.
2. Create a **Quick Cup (4 songs)**, **Main Event (8 songs)**, or **Marathon (16 songs)** using either the currently loaded Deezer discovery catalog or your saved favorites. If your pool has fewer than the chosen bracket size, go to Discover, let new tracks load, and return. The app does not invent missing tracks.
3. Every matchup shows two real songs. Play either **22-second** preview, then click **Choose A** or **Choose B** (keyboard: 1 or 2) to advance that song. Choosing is immediate and does not count as a normal Keep or Pass.
4. The two losing semifinalists compete for **third place**. The last matchup decides **first and second**.
5. Finished podiums appear in Tournament History. Use **Add podium to Collection** to save those tracks as favorites, or **Export podium playlist CSV** to export the top three ranked songs.
6. After two *distinct* winners from completed regular tournaments, **Champions Cup** becomes available. You can start with two champions; when there are 4/8/16 champions, larger cups are available automatically. A two-song cup awards first and second, but cannot award third.


## Themed tournament arenas (v0.10.0)

The **Choose your arena** cards above the bracket form change who is eligible for a tournament. Choose an arena, a 4/8/16-song bracket, and a discovery/favorites pool. Each card's eligibility count updates when the bracket size or song pool changes, so an arena never says it is ready for 4 entrants if you selected 16. The Start button is disabled for ineligible brackets and **Find More Songs** returns to Discover. No separate import, database, or special audio source is required.

| Arena | Eligibility and gameplay |
| --- | --- |
| Open Stage | General loaded Deezer tracks; performer-diverse selection. |
| Favorites Face-Off | Only tracks you explicitly saved to Collection (including saved songs from previous sessions). |
| Fresh Faces | Songs that are not favorites and are not by artists whose songs you've saved. |
| Mystery Matchups | Any playable tracks; artist/title/artwork remain hidden in the card, status line, and bracket until the event finishes. |
| Pop vs Rock | Exactly half verified Pop and half verified Rock, paired head-to-head in round one. Songs with inferred/unknown genre do **not** count. |
| 2000s Throwback | Only tracks with explicitly supplied release years from 2000 through 2009, not year guesses from artist name, title, or search filter. |

Genre and release-year metadata are often missing from Deezer's chart/artist search results. The corresponding genre or decade arena may be unavailable. **Do not weaken eligibility to fabricate matchups.** Favorites, Fresh Faces, Open Stage and Mystery Matchups work with ordinary Deezer metadata when enough songs are loaded.

## Hall of Fame

Every finished tournament contributes to the Hall of Fame. First place earns **5 points**, second **3**, third **1**; an additional **5 bonus points** applies to a Champions Cup first-place finish. Each row shows gold, silver, bronze, distinct Champions Cup crowns, points, and latest win. The scoreboard is derived from existing archive results: deleting an archived event automatically updates the standings. All-time and quarterly (UTC calendar quarter) views are offered, plus an exportable leaderboard CSV.

**Save champions to Collection** adds distinct winning songs to your favorites explicitly, while **Add podium to Collection** still adds a specific event's top three. Neither tournament votes nor the Hall of Fame automatically alter your listening taste profile. The two-winner Champions Cup still awards first/second only.

**Storage compatibility:** older `aftertone:duels:v1` events have no `themeId` field and are shown as Open Stage. New themed events store only a small optional `themeId` and truthfully supplied `releaseYear` and `genreVerified` flags. Existing local browser data is untouched and no migration reset is required.

## Design and implementation

- Bracket algorithm: `src/duels.mjs`, pure functions `createTournament`, `nextDuelMatch`, `voteDuel`, `duelProgress`, `availableChampions`, `podiumTracks`, and persistence. Each match allows only one winner from its two listed contestants; stale votes cannot mutate a later round.
- UI: `public/duels-view.js` renders a responsive, escaped, read-only snapshot. `public/main.js` handles event delegation, previews, votes, export, and storage. Bracket state never changes from rerendering.
- Persistence: the versioned archive key `aftertone:duels:v1`, distinct from the listening session, and `aftertone:duels:selection:v1` for which bracket was last opened. **Close Bracket** is remembered. New visitors with no selection reopen the newest unfinished event. Existing favorites, themes, history, seed artists, and imported playlist remain untouched. Up to 40 tournaments are retained. Entries store small track snapshots to reopen brackets after a catalog refresh. A new vote or tournament is displayed only if saving it succeeds.
- Single-audio-element playback uses the existing `/api/audio?id=...` provider resolver, bounded to the same 22-second preview as Discover. No DRM bypass, download of full songs, or playback when the source is unavailable.
- Songs enter from Deezer because it is the only normal discovery provider currently exposed by the application. The user can expand that available pool by listening and discovering more songs first.
- Champion uniqueness is based on **track ID**, not artist name, to avoid creating a duplicate champion face-off with the same recording.
- The optional third place match is scheduled before the grand final so the last battle crowns the champion.
- CSV includes **rank**, **track name**, **artist name**, **source**, and **tournament**. It is a metadata export; it does not create a playlist inside Deezer or Spotify or imply rights to the recordings.

## Practical verification walkthrough

The [README screenshot](screenshots/app-music-duels.webp) demonstrates the actual Music Duels interface with **fictional sample track metadata**, not live Deezer results.

1. Open [AFTERTONE Music Duels](https://aftertone.masynnay.com/demo/) using the left navigation. With a small discovery catalog, choose **16 songs** and **My favorites**. All six arena cards must show how many entries qualify; Start Bracket stays disabled until enough eligible songs exist. Use **Find More Songs** to return to Discover.
2. Return when the discovery catalog contains at least four eligible tracks. Select **Open Stage**, **4 songs**, **Discovery songs**, then **Start Bracket**. Both contenders should have preview and Choose controls.
3. Select the winner of the first matchup, refresh the browser, and reopen **Music Duels**. The same tournament and its completed vote should reappear. The archive should also provide **Resume Tournament**.
4. Finish the second opening match, then the **Bronze Match** and **Grand Final**. A three-place podium must display, and the Hall of Fame should list the resulting champions.
5. Select **Export Leaderboard CSV**. It must contain ranked track metadata, not music files. Close the bracket, refresh, and confirm the closed state is respected; reopen it from Tournament History.
6. Test each arena with eligible and ineligible pools. **Pop vs Rock** requires verified genre tags, **2000s Throwback** requires confirmed years, and **Mystery Matchups** must keep track identities hidden until the event finishes.
7. Check the same flow with 8 and 16 entrants. Saved progress must survive browser reloads. For transfers to a different browser, see the separate [Backup and Restore guide](BACKUP_RESTORE.md).

## Automated verification

Run `npm run check`. `test/duels-reliability.test.mjs` checks the full **6 arenas × 3 bracket sizes** matrix, reload after every vote, scarcity, archive selection, mystery reveal, safe persistence, podiums, and CSV exports. Earlier tournament tests remain in `test/duels.test.mjs` and `test/themed-tournaments.test.mjs`.

The GitHub Pages Chromium smoke test uses the actual generated app with fictional catalog fixtures, deliberately tests an unavailable 16-song favorites cup, creates a four-song tournament, resumes after refresh, completes the bronze/final bracket, downloads a Hall of Fame CSV, and checks Close/Reopen across reload. It does **not** contact Deezer for real playback.

## Public deployment / licensing

Like the existing discovery game, Music Duels is a local technical prototype. Deezer has not provided a public game license. Seek the relevant rights and developer authorization before publishing music playback or lyrics to users beyond personal/local evaluation.
