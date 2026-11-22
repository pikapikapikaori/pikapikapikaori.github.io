export {
    BangumiApi, configureExternal, fetchEpisodeData, mainEpisodeCount,
    readProgress, requestTimeoutMs, retryWaitMs,
} from './bangumi-api.js'
export {
    addAccessToken, beginAuthorization, finishAuthorization, listCredentials, refreshAccessToken,
    removeCredential, requireAccessToken,
} from './bangumi-auth.js'
export { createBgmSource, createStaticStats } from './bangumi-static.js'

// Field conventions of the external site's collection data.

// The moment a collection last changed. Incremental planning and the storage
// merge both compare this field, so it lives here, not in project code.
export const collectionVersionField = 'updated_at'
