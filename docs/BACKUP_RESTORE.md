# AFTERTONE — Backup and Restore

AFTERTONE stores listening progress locally in your browser. Clearing browser storage or moving to another device can remove saved data unless you export a copy.

## Create a backup

1. Launch the [AFTERTONE application](https://aftertone.masynnay.com/demo/) and open **Collection**.
2. Choose **Backup Progress**. This works even if you have not saved a song yet.
3. Save the downloaded `aftertone-progress-YYYY-MM-DD.json` file somewhere private and accessible.

The backup includes saved favorites and track metadata, Keep/Pass listening history, audio volume and theme preferences, discovery choices, Music Duels brackets and Hall of Fame records, Tune Lab results, and favorite artists selected for personalization.

**It does not contain music files or downloadable Deezer audio.** This initial backup format also excludes imported playlist files and manual lyric timing offsets, which you may need to reimport or adjust separately.

## Restore a backup

1. Open **Collection** in the browser where you want to restore progress.
2. Choose **Restore Backup** and select an AFTERTONE progress JSON file.
3. Review the saved-track, listening-choice, tournament, and artist counts.
4. Confirm only if you want to **replace** the current browser's progress. Existing data is not automatically merged.
5. AFTERTONE reloads with the restored data.

**Before restoring, export a backup of your current progress.** If a file is malformed or its format is unsupported, AFTERTONE rejects it without writing data. If browser storage fails mid-restore, the app attempts to roll back changes; some storage failures can also prevent complete rollback.

## Privacy and compatibility

- JSON backup files are **not encrypted**. They can reveal your listening preferences and saved artists. Don't post them publicly.
- Files must use the `aftertone-progress` format, version `1`, and be smaller than 4 MB.
- The old **Export Library** and CSV options are track-list exports, not full restorable progress backups; keep them for spreadsheets or playlists.
- The feature works locally through the browser without a login or cloud account.
- The original tracks' availability still depends on third-party providers, region, and licensing. Restored metadata does not guarantee that any given audio preview will play.

## Engineering verification

The [browser smoke suite](BROWSER_TESTING.md) tests actual JSON download and restore through the UI using a fixture catalog. `test/progress-backup.test.mjs` covers sanitization, bad files, version rejection, round trips, and rollback behavior.

Remaining roadmap work: additional saved-data migration formats, optional imported-playlist and lyric-offset backups, and manual Firefox/Chrome verification.
