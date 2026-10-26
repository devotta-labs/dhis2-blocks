import { FetchError } from '@dhis2/app-runtime'
import { z } from 'zod'
import { sessionLapsed } from '../outbox/sync'
import { SAVE_TIMEOUT, withinLimit } from '../sources/eventSave'
import type { DataEngine } from '../sources/types'
import { pauseReason } from './completion'

const ME_QUERY = { me: { resource: 'me', params: { fields: 'id' } } }
const meSchema = z.object({ me: z.object({ id: z.string() }) })

/** Asks DHIS2, before anything is sent, whether the signed-in user is the one whose changes these are. */
export const userCheck = (engine: DataEngine, userId: string) => {
    /**
     * Whether the server's signed-in user is this outbox's: not for someone else (another tab may have signed in;
     * the session is shared) or a lapsed session. Any other failure says nothing of the changes: it throws a plain
     * error, which the sync loop retries and never takes as a refusal.
     */
    const signedInHere = async () => {
        try {
            const { me } = meSchema.parse(
                await withinLimit(SAVE_TIMEOUT, (signal) =>
                    engine.query(ME_QUERY, { signal })
                )
            )
            return me.id === userId
        } catch (error) {
            if (error instanceof FetchError && sessionLapsed(error)) {
                return false
            }
            throw new Error('Could not ask DHIS2 who is signed in')
        }
    }
    return {
        signedInHere,
        /** Why nothing should be sent now: offline, or not signed in as this outbox's user. */
        notNow: async () =>
            !navigator.onLine
                ? pauseReason('offline')
                : (await signedInHere())
                  ? undefined
                  : pauseReason('signIn'),
    }
}
