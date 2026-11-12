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
3. Review the saved-track, listening-choice, tournament, artist, imported-playlist, and lyric timing counts.
4. Confirm only if you want to **replace** the current browser's progress. Existing data is not automatically merged.
5. AFTERTONE reloads with the restored data.

**Before restoring, export a backup of your current progress.** If a file is malformed or its format is unsupported, AFTERTONE rejects it without writing data. If browser storage fails mid-restore, the app attempts to roll back changes; some storage failures can also prevent complete rollback.

## Privacy and compatibility

- JSON backup files are **not encrypted**. They can reveal your listening preferences and saved artists. Don't post them publicly.
- New files use `aftertone-progress` format **version 2**; existing **version 1** backups also import. Both must be smaller than 4 MB.
- Importing a version 1 backup restores its original saved session, duels, score, and artist settings **without deleting any separately saved imported playlist or lyric offsets already in the destination browser**. Version 2 backups explicitly replace those optional settings (including clearing a playlist not present in the backup).
- The old **Export Library** and CSV options are track-list exports, not full restorable progress backups; keep them for spreadsheets or playlists.
- The feature works locally through the browser without a login or cloud account.
- The original tracks' availability still depends on third-party providers, region, and licensing. Restored metadata does not guarantee that any given audio preview will play.

## Engineering verification

The [browser smoke suite](BROWSER_TESTING.md) tests actual JSON download and restore through the UI using a fixture catalog. `test/progress-backup.test.mjs` covers sanitization, bad files, version rejection, round trips, and rollback behavior.

Remaining roadmap work: manual Firefox/Chrome cross-device restoration, future migration formats as state schemas change, and accessibility checks for backup and restore. The CI browser test uses fictional provider fixtures and does not verify real Deezer playback.
