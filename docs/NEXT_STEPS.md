# Product roadmap and engineering notes

## V0.2 — Personal discovery loops

- Add play-then-confirm controls for disabled auto-start, loading indicators, playback failure skip, and source health telemetry that respects privacy.
- Build a full provider abstraction with licensing flags and normalized `Track` capabilities (`preview`, `lyricsApproved`, `commercialUseAllowed`, attribution metadata).
- Add a new artist repetition constraint, exploration slider, and interleaving diverse genres in shorter sessions.
- Tune the balance between selected moods and editorial moods; validate recommendations with user testing rather than claiming perfect personalization.
- Add playlists and an explicit `Listen later` rather than mixing all liked tracks together.
- Add unit tests for corrupted state, unavailable APIs and high-volume state, plus accessibility tests and visual snapshot tests in a real browser.

## V0.3 — Trivia engine

- Make question types extensible, implementing familiar song quizzes: `artist`, `title`, `album`, `genre`, `year` (only when metadata is verified).
- Add "Finish the line" **only** for original lyrics provided by artists or verified explicitly licensed lyric text. Store licensing provenance per lyric and optionally use short lyric challenges, not full lyrics. Do not scrape lyrics sites.
- Add adaptive confidence tracking that asks "did you recognize it before this session?" and measures accuracy, avoiding the false assumption that a trivia miss means someone dislikes a song.
- Add audio-safe timeout states and consider carefully whether skip/quiz choices should affect ranking.

## V0.4 — Shared taste

- Full session result comparison based on the same challenge track IDs and invite IDs. Exchange signed/validated small datasets without identities by default.
- Add opt-in profiles and login only when social play actually requires them.
- Block abuse with token expiration, rate limits and anti-spam guardrails.

## Hardening checklist for public hosting

- License review for every audio provider and track category.
- Server-supplied access tokens and storage secrets kept off the client.
- HTTPS, security headers/CSP, HTTP caching, request timeouts, provider concurrency limits and observability.
- Data retention and deletion controls, backup/recovery, schema migrations and graceful reconnects.
- Browser compatibility review including `.opus`/`.oga` support in Safari and Firefox.
- Accessibility WCAG audit and mobile screen-reader pass.
- More than one integration/UX smoke test in an actual browser.

## Technical choices

This first iteration uses native browser modules and Node's standard library to keep the portfolio source transparent, easily testable and simple to run. Presentation is controlled with CSS variables; state rules live in pure functions, which have no DOM dependencies. Browser click handling uses delegation to avoid repeated listeners across rerenders. Audio is one singleton HTMLAudioElement rather than a new player per card.
