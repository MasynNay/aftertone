# AFTERTONE — Backup and Restore

AFTERTONE stores listening progress locally in your browser. Clearing browser storage or moving to another device can remove saved data unless you export a copy.

## Create a backup

1. Launch the [AFTERTONE application](https://aftertone.masynnay.com/demo/) and open **Collection**.
2. Choose **Backup Progress**. This works even if you have not saved a song yet.
3. Save the downloaded `aftertone-progress-YYYY-MM-DD.json` file somewhere private and accessible.

The backup includes saved favorites and track metadata, Keep/Pass listening history, audio volume and theme preferences, discovery choices, Music Duels brackets and Hall of Fame records, Tune Lab results, favorite artists, imported playlist artist/song names, and manual lyric timing adjustments.

**It does not contain music files or downloadable Deezer audio.** As of backup format v2, it also preserves the imported playlist's artist and song names (not the original CSV file) and per-song manual lyric timing adjustments.

## Restore a backup

1. Open **Collection** in the browser where you want to restore progress.
2. Choose **Restore Backup** and select an AFTERTONE progress JSON file.
3. Review the saved-track, listening-choice, tournament, **favorite-artist**, and Tune Lab score counts in the native confirmation dialog. Version 2 also shows imported-playlist and lyric timing counts. The Collection page warns that restore replaces current progress and that JSON backups are not encrypted.
4. Confirm only if you want to **replace** the current browser's progress. Existing data is not automatically merged.
5. AFTERTONE reloads with the restored data.

**If Backup Progress reports damaged saved data**, AFTERTONE stops instead of silently creating an apparently valid but incomplete backup. This protects the original browser storage; it does **not** repair the damaged record. Keep the browser data intact, retain an earlier trusted backup if available, and avoid replacing progress with a newly generated empty backup.

**Before restoring, export a backup of your current progress.** If a file is malformed or its format is unsupported, AFTERTONE rejects it without writing data. Validation errors remain visible in Collection after the brief toast disappears. Canceling the confirmation preserves existing progress and returns keyboard focus to Restore Backup. Overlapping file imports are ignored while an import is being checked. If browser storage fails mid-restore, the app attempts to roll back changes; some storage failures can also prevent complete rollback. Each restore write and removal is now read back before the app reports success, including writes that fail silently without an exception. Rollback values are checked the same way. If rollback cannot be confirmed, AFTERTONE reports incomplete recovery instead of claiming that your previous progress is safe. Keep a separate backup file before restoring.

## Privacy and compatibility

- JSON backup files are **not encrypted**. They can reveal your listening preferences and saved artists. Don't post them publicly.
- A backup exported from an older local session may contain favorite IDs but no matching saved titles/artists. **Backup Progress** warns about this after download; **Restore Backup** warns before asking permission to replace your current data. You should keep any older complete backup files instead of assuming missing track details can be recovered.
- New files use `aftertone-progress` format **version 2**; existing **version 1** backups also import. Both must be smaller than 4 MB.
- Early version 1 backups **without a `savedTracks` field** can still restore their saved favorite IDs, listening decisions, duels, Tune Lab scores, and artist choices. These backups contain no title/artist metadata for some favorite IDs, so those favorites may not display in Collection until their track details are found again. AFTERTONE does **not** invent metadata or audio. The restore confirmation explains this limitation. An explicitly invalid `savedTracks` value is rejected, and version 2 backups still require that field.
- Importing a version 1 backup restores its original saved session, duels, score, and artist settings **without deleting any separately saved imported playlist or lyric offsets already in the destination browser**. Version 2 backups explicitly replace those optional settings (including clearing a playlist not present in the backup).
- The old **Export Library** and CSV options are track-list exports, not full restorable progress backups; keep them for spreadsheets or playlists.
- The feature works locally through the browser without a login or cloud account.
- The original tracks' availability still depends on third-party providers, region, and licensing. Restored metadata does not guarantee that any given audio preview will play.

## Engineering verification

The [browser smoke suite](BROWSER_TESTING.md) tests actual JSON download and restore through the UI using a fixture catalog. `test/progress-backup.test.mjs` covers sanitization, bad files, version rejection, round trips, and rollback behavior.

Automated Chromium **and Firefox** browser tests now exercise nonempty JSON backup export, invalid import rejection without changing storage, confirmed restore, post-refresh local data integrity and visible restored favorites. Additional tests export an actual file in one browser context, **close that source context**, open a fresh context with independent storage, import the downloaded file through the real input/confirmation UI, and verify favorites, history, tracks, Tune Lab, favorite artists, imported playlist names and lyric timing data after another reload.

This verifies **separate profiles within each browser engine**, not copying data between physical devices or from Firefox into Chromium. Remaining roadmap work: manual transfer between physical devices/browsers, future migration formats as state schemas change, and accessibility checks for backup and restore. CI uses fictional provider fixtures and does not verify real Deezer playback.
