# AFTERTONE — Your First Listen

AFTERTONE is an independent music discovery experience. Start from the [portfolio site](https://aftertone.masynnay.com/) and select **Explore the Experience**, or open [the app directly](https://aftertone.masynnay.com/demo/).

## Choose a direction

**Comfort Zone** draws closer to saved artists and their musical neighbors. It becomes more personal as you Keep songs.

**New Territory** blends related artists with broader recommendations, so you can explore outside what you already know.

**Wild Card** leans toward unfamiliar genres and artists.

You can switch listening paths whenever you like. Manually searching for an artist temporarily takes precedence over the chosen discovery path.

## Listen and shape your taste

1. Choose a path, or search for an artist.
2. Press **Play** once to begin a short preview. Use the volume control as needed.
3. Choose **Keep** to save what you enjoy or **Pass** to move on. **Undo** is available for the previous decision.

Continuous listening may move through previews after your first user gesture. Browser/provider restrictions can interrupt audio, and some previews may not be available.

When focus is not inside a button or form control, the standalone **Left Arrow** and **Right Arrow** keys Pass or Keep; **Space** plays/pauses and **B** toggles blind mode. Shortcuts ignore Ctrl, Command, Alt, Shift, composition and key-repeat events so browser shortcuts and held keys do not accidentally rate extra songs. Buttons and sliders keep their native keyboard behavior.

## Search without losing your place

While typing an artist or song name, your unfinished search stays in the search box even if the discovery view refreshes or you briefly visit your Collection. A draft does **not** change what Aftertone recommends until you press Enter or the Search button. A refreshed listening screen keeps the text cursor and search focus, and Clear Search intentionally discards the draft. If you submit a different search or change listening paths while Deezer is still responding, Aftertone cancels the obsolete catalog lookup instead of allowing it to affect the new session.

## When you find no matches

An empty screen is not a reason to erase your history. You can **Retry Search / Find More Songs**, **Clear Search**, **Broaden Filters** to return to all genres, languages, and eras, switch to a different listening path, or **Search for an Artist**. These actions don't remove favorites or prior Keep/Pass choices. Keyboard users can activate Retry Discovery with Enter, and focus returns to the new **Retry Discovery** control if the source remains unavailable or to **Play** if a track is found. Route switches and recovery controls are also designed to retain a useful focus target after the card changes.

If an audio preview itself fails, use **Retry Preview** or **Skip Without Voting**. Unavailable audio is not a negative vote against the artist. When an artist search fails because Deezer is slow or unavailable, Aftertone now stops rather than immediately launching more provider lookups. Use **Retry Discovery** when the service recovers; your favorites and listening decisions stay intact.

## Find songs in your Collection

Collection lets you filter saved songs by title, artist or genre and sort them by recently kept, song title or artist. While filtering, the app shows how many of your saved songs match. If nothing matches, choose **Show All Saved Songs** to clear the filter and return to the search field. Changing the sort order keeps the dropdown focused for keyboard navigation. Filtering and sorting never delete favorites or modify listening history. If you accidentally remove a song, **Undo Remove** appears in Collection (even after removing the last saved song). It restores your favorite without creating a new Keep vote. Undo remains available while this browser tab stays open, until you remove another song; for longer-term safety, export a progress backup.

## Saved progress and provider limitations

Open **Collection** to save or restore progress via [Backup and Restore](BACKUP_RESTORE.md). Real Deezer catalog and playback may be limited by upstream availability, region, browser policies, and content permissions. This project doesn't host or distribute copyrighted recordings, and the demo is not an official Deezer service.

## Share a blind challenge

Keep a Deezer preview, then open **Challenges** and choose **Make my challenge**. The link contains up to five public track IDs, not listening history, favorites, stored preferences, artwork copies, media files, or temporary audio links. A friend opening it in a new browser requests those same records from the provider. If a recording is unavailable, the challenge may be shorter or temporarily unavailable.

**Try a sample** starts with the playable Deezer tracks already loaded in your browser. If none have loaded, visit Discover first. Preview availability does not establish authorization for public game use.

### When someone opens a challenge and songs are missing

AFTERTONE keeps the original shared ID-only link unchanged. If Deezer cannot load every recording, the listener sees how many are available. **Retry Missing Songs** checks the unavailable public Deezer IDs without making a Keep/Pass choice. If some work, **Play Available Songs** deliberately starts a shorter challenge and marks the omitted count. **Back to Discovery** exits the challenge and loads regular music. If none work, the app does not silently switch to another song or mark a challenge complete. Older links for providers not configured on the public demo may show an unavailable state without a Deezer retry option. Refreshing the original link gives it another try.

### If a shared song loads but will not play

Some public tracks can still fail at playback time even if their metadata loads. Press **Retry Preview** to request a fresh provider URL, or **Skip Without Voting** to move to the next shared song without marking a Pass. The result tells you exactly how many songs you actually rated and how many previews could not play. **Leave Challenge** is always available while rating. Challenge clips stop after their short preview and wait for your Keep/Pass decision rather than automatically looping or silently advancing. Regular Discover sessions still support continuous listening.

### Choose and order the songs in Pass the Aux

On the **Challenges** tab, your five latest eligible Deezer favorites start selected, so the Share action works immediately. To make it personal, **Remove** a selected song, search by title or artist to find another saved recording, and use **+ Add** to include it. Move songs earlier or later with the up/down buttons; the first selected song is what a friend hears first. At most five songs can be shared. **Use Latest Five** restores the default. Search looks through all saved eligible recordings, showing up to 40 at once (narrow the query for older tracks). Your customized song selection and order now survive a refresh **in the same browser tab** when session storage is available. The draft is not synced to other tabs, devices, or accounts. The shared link keeps the chosen song IDs and order when opened elsewhere. If storage is blocked, the editor warns that the selection cannot be restored after refresh. **Use Latest Five** clears the draft, including its tab-local copy. Editing a challenge does not remove favorites or create listening votes.
