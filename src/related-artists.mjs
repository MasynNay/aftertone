/** Public adapter retained for existing endpoint/tests; Deezer supplies the
 * artist graph, so recommendations arrive from the same music catalog we play.
 * No user token, Spotify dependency, MusicBrainz identity guess, or account.
 */
export {fetchDeezerRelatedArtists as fetchRelatedArtists,parseDeezerRelated} from './discovery/related-deezer.mjs';
