# AFTERTONE — Music Duels v0.10.0 test checklist

## Automated
Run `npm run check`. It checks JavaScript syntax and the Node test suite. Keep any failures in the journal before publishing a replacement build.

## Desktop and mobile acceptance
1. Discover enough playable Deezer songs and save at least four favorites. In Music Duels, create an **Open Stage** Quick Cup. Preview both entries; choose winners with buttons and keyboard 1/2. Confirm bronze match runs before final.
2. Open **Favorites Face-Off**: every contender must be from Collection. Create **Fresh Faces**: saved artists should not be repeated if there are enough eligible songs.
3. Start **Mystery Matchups**: no artist, title or cover should appear in contender cards, current-player status or open bracket. Finish the event and confirm names are revealed on the podium.
4. Try **Pop vs Rock** and **2000s Throwback**: if tracks lack trusted metadata, the Create button must be disabled with an honest reason. Never fill such events with unrelated songs.
5. Complete a second tournament with a different champion. Launch the **Champions Cup** and vote through it. Open the **Hall of Fame**: verify both original gold medals, the Champions Cup title, scores and quarterly filter.
6. Export both a podium CSV and Hall of Fame CSV. Choose Save champions to Collection; verify it adds winners once without changing your earlier favorites or listening history.
7. Refresh the browser while a tournament is in progress. Resume it, complete it, then reload and confirm the podium persists. Old v0.9.4 brackets must still display under Open Stage.
8. Try a narrow/mobile viewport: arena cards, volume slider, matchup buttons, leaderboard and archive controls should remain usable. Check keyboard focus and reduced-motion settings.

## What Node tests do not prove
Deezer's real stream availability, autoplay under your Mac browser, preview CDN restrictions, platform-specific audio levels, on-device responsive rendering, public game licensing, and lyrics licensing. These require independent verification before public launch.
