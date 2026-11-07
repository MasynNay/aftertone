## v0.9.4 sound-level regression checklist

1. On a fresh browser profile, open Discover and confirm the player shows **35%** before pressing Play. Start music at a comfortable device volume.
2. During a preview, drag the volume slider to 12% and then 65%. Check that the volume changes immediately, without restarting the song or passing/keeping it.
3. Swipe Keep/Pass and allow automatic advancement. Confirm each new preview uses the last selected volume, not 100%.
4. Use the navbar mute button while set to 65%; verify silence, then unmute and verify 65% returns. Slide to 0 and confirm mute; unmute to recover at 35%.
5. Navigate to Music Duels, start or resume a bracket, and check its 0–100% slider shows the same level; preview both tracks to confirm shared volume.
6. Refresh AFTERTONE and confirm volume, favorites, themes, five artists and tournaments survived. Keyboard users should be able to focus the range and adjust with arrows.
7. On touchscreens, dragging the range slider must not trigger a swipe vote. Verify small/mobile widths show the entire slider and percentage.
8. Confirm the browser and operating-system volume can still mute playback independently. Volume normalization between different source recordings is **not** implemented.

# AFTERTONE v0.6.0 playtest

This manual test is designed to catch the exact problem that prompted the update: "I picked five artists, and I only hear those five." Use a new listening session, but **do not clear browser storage** or saved favorites.

1. Open the first-run introduction (or use **Choose favorite artists** in the sidebar). Enter five distinct artists, ideally spanning a few styles. Start artist-powered discovery.
2. Confirm the status banner says that it's finding related artists. Wait until it reports a number of real related artists, or the fallback status. No related-artist count should be invented.
3. Listen or skip through twenty tracks. Record how many were by the original five, how many by newly suggested performers, and how many were broad chart choices. Note the provider can return zero or fewer playable songs in certain regions.
4. Try **Balanced**, **Adventurous**, and **Closer to my favorites** from the left sidebar. You should notice a change in the selection mix, but it won't be a perfectly fixed ratio if the underlying results run out.
5. Keep a track by a new artist, then continue for another ten songs. A successful related-artist fetch should add suggestions branching from that artist.
6. Pass two tracks by the same artist. When alternative artists are available, that artist should be deprioritized.
7. Search for one specific artist and clear the search. The previous search results should not be injected into the normal recommendation feed.
8. Close and reopen the web app. Your songs, theme and five saved artist names should remain. The *active* five-artist recommendation mode should be off again by design.
9. Verify that Play/Pause, 22-second previews, continuous Keep/Pass playback, Tune Lab, Blind Mode, favorites export and mobile layout behave as before.

**If something goes wrong**, capture the Terminal server error and browser console message, plus the selected discovery mix and whether related artists were actually found. These distinguish a missing provider response from a broken recommendation algorithm.

## v0.6.1 verification
- Check the heart/X buttons are *inside* the artwork/player card on desktop and mobile; swipe/keyboard shortcuts remain available.
- Try a public Deezer playlist URL; confirm only the playlist artist/title pairs are imported. The URL is not fetched directly by the browser.
- Try a Spotify playlist URL: expect a clear unsupported explanation, not a fake successful import.
- Check Balanced and Adventurous over 20 songs; original five should not dominate. More-familiar mode may show the seed artists occasionally.


### v0.8.0 interactive checks

1. In Discover, confirm the actions are **X / Undo / Blind / Heart** in that order. Toggle Blind during playback without pausing music; confirm artwork and artist details hide/reappear. Try keyboard **B**.
2. Click the navbar crescent moon, choose a theme, and confirm the page updates instantly. Reopen and confirm the selected option; press Escape and click elsewhere to close. Test at phone width.
3. Open the Passport. Keep three songs and confirm the first stamp. Keep from five different artists for the second. Enter Wild Card and rate seven songs; verify it does not count decisions from searches or passive preview advancement. Answer five Tune Lab questions for the fourth stamp.
4. Undo a Keep and verify corresponding Passport progress updates. Restart the app and verify existing favorites and earned stamps (as derived from stored history) remain.
5. Ensure playback, automatic three-second queue refill, lyrics and other existing interactions remain functional in a live browser. Automated tests cannot verify live Deezer availability or public playback rights.

## v0.9.0 Music Duels — manual Mac checks

1. Ensure Deezer discovery has loaded at least 8 songs, then go to Music Duels. Select **8 songs · Main Event** and press Start Bracket.
2. Preview A, preview B. Ensure only one audio stream plays at a time and the 22-second timer fills. Click Choose A. Verify the bracket advances and A is marked winner.
3. Finish quarterfinals and semifinals. Verify that the **bronze matchup happens before the grand final**, then finish. Confirm the top three are distinct.
4. Export podium CSV, open it in a text editor, and verify three ranked songs. Click Add podium to Collection; the songs should appear in Collection.
5. Start a different tournament, with other songs if possible. Finish it with a different winner. Start the Champions Cup. Verify both winners appear and the Cup saves independently.
6. Reload the browser, reopen an archived tournament, replay a contender, and verify the full history and podium survive.
7. Return to Discover. Verify continuous listening, Keep/Pass, Blind, themes, lyrics, Passport, and favorite counts work as before.
8. Check a narrow/mobile browser window for readable contender cards and an accessible theme button.

Note: the browser automation environment cannot open the local app URL. This list requires a real client; automated unit tests only validate data transitions and server/UI structure.

## v0.9.1 — Discovery mode differentiation

1. Start normally with five artists; save at least two distinct tracks. Confirm **Comfort Zone** favors saved artists and Deezer neighbors. Searches should remain deliberately searchable, even if a path would normally exclude that artist.
2. Choose **New Territory**. The new queue should load; expect performers besides your five initial artists or artists you've saved. The displayed reason should match the newly selected path.
3. Choose **Wild Card** with **All genres**. Listen through at least ten tracks, checking for genre/performer changes. You should not get the saved artists or their known related neighbors from the Wild Card path.
4. Choose one genre explicitly and return to **Wild Card**. Confirm the genre selection is honored, while performer exploration continues within that style.
5. Switch back and forth between all three modes while playing. The app should stop continuous listening on a mode switch, isolate its queue, and preserve favorites/Passport/duels.
6. Search for one of your five favorites while Wild Card is active; search should work. Clear the search and check that Wild Card stops recycling those results.
7. Check the Music Duels icon in the sidebar on desktop and mobile; it should share the others' monochrome size, alignment and active styling.
8. Play live Deezer previews on the Mac: confirm autoplay follows a deliberate Play, provider preview links don't expire mid-session, and no stale audio survives switching paths. Browser/region/provider restrictions may differ from mocked tests.

## v0.9.2 — empty-feed regression and search shortcut

1. After updating, do **not** clear storage. Keep the existing liked songs,
   history, playlists and tournaments. Select **Comfort Zone** with All genres,
   All languages. It should show playable Deezer tracks, even if its saved-artist
   suggestions take time to load. A temporary fallback should say so.
2. Choose **New Territory** and **Wild Card**, comparing at least 10 songs in
   each. Unheard performers are preferred; neither path should display a blank
   page while valid, not-yet-heard Deezer tracks are available.
3. Complete 20 Keeps/Passes and switch paths again. Verify that already-heard
   songs do not occupy the active queue, and the three-second refill continues.
4. Manually search for an artist, play/Keep a result, clear the search, then
   return to New Territory. That search's other results must not flood the feed.
5. Click **Search a new artist** under the Discover heading. Search should
   appear in the sidebar and receive keyboard focus (also on phone width).
6. Open Music Duels. Its header should have no decorative trophy. Confirm
   existing tournaments, brackets, champion promotion and exports are intact.
7. With live Deezer temporarily unreachable, verify a truthful availability
   message and a retry delay rather than endless fetch attempts or fake audio.
8. Stop and restart the local app, then switch to Comfort Zone: your saved Keeps
   should still inform Deezer related-artist discovery without data reset.

The Node tests emulate provider data; this checklist still requires a real Mac
browser and actual music-host connectivity.

## v0.9.3 — Artist search and instant mode differentiation

1. Preserve your existing browser storage. With 5+ songs kept by at least 2
   artists, open **Comfort Zone** and check the next track: it should come
   from its own newly fetched saved/related artist route, not the previous mode.
2. Choose **Wild Card** and then **New Territory**. Each switch should briefly
   display a fetching state if its route is not already loaded, then a new
   performer or a clearly explained fallback. It must not immediately relabel
   the song that was playing when the button was clicked.
3. Search **Harry Styles**. The first results should be credited to the real
   artist and have Deezer artwork/previews, without needing repeated manual
   Load More actions. Search **Watermelon Sugar** as a song title too.
4. With that search still active, click Wild Card. Confirm the search is
   closed automatically and Wild Card finds a different queue. Switch back to
   Comfort; confirm favorites still exist and haven't become a search queue.
5. Swipe 15+ times per mode; confirm the three-second background refill still
   loads further tracks and that mode switches do not restart a stopped player.
6. Verify Music Duels, the crown sidebar icon, Undo, Blind, Tune Lab, themes,
   saved playlist imports and archive persistence remain unchanged.
7. For a failed Deezer request, check that the app reports it or shows an honest
   available-song fallback *after* trying the selected path. It should never
   falsely identify an unrelated song as a related artist.

Run `npm run check` for deterministic tests. A real Mac/browser Deezer listening
check remains necessary; browser autoplay and preview licensing are separate.
