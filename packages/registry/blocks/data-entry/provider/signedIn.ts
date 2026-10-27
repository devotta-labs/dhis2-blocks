import { FetchError } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import { sessionLapsed } from '../outbox/sync'
import { SAVE_TIMEOUT, withinLimit } from '../sources/eventSave'
import type { DataEngine } from '../sources/types'
import { pauseReason } from './completion'

const ME_QUERY = { me: { resource: 'me', params: { fields: 'id' } } }
const meSchema = z.object({ me: z.object({ id: z.string() }) })

/** Why a form locks once someone else has signed in. */
export const signedInAsOther = () =>
    i18n.t('Signed in as someone else. Reload to continue as that user.')

/**
 * Asks DHIS2, before anything is sent, whether the signed-in user is the one whose changes these are. `onOther` runs
 * each time it is someone else.
 */
export const userCheck = (
    engine: DataEngine,
    userId: string,
    onOther: () => void
) => {
    /**
     * Whether the server's signed-in user is this outbox's (`here`), someone else (another tab may have signed in; the
     * session is shared) or no one: a lapsed session. Any other failure says nothing of the changes: it throws a plain
     * error, which the sync loop retries and never takes as a refusal.
     */
    const signedIn = async (): Promise<'here' | 'other' | 'lapsed'> => {
        let id: string
        try {
            id = meSchema.parse(
                await withinLimit(SAVE_TIMEOUT, (signal) =>
                    engine.query(ME_QUERY, { signal })
                )
            ).me.id
        } catch (error) {
            if (error instanceof FetchError && sessionLapsed(error)) {
                return 'lapsed'
            }
            throw new Error('Could not ask DHIS2 who is signed in')
        }
        if (id === userId) {
            return 'here'
        }
        onOther()
        return 'other'
    }
    return {
        signedIn,
        /** Why nothing should be sent now: offline, signed out, or signed in as someone else. */
        notNow: async () => {
            if (!navigator.onLine) {
                return pauseReason('offline')
            }
            const who = await signedIn()
            return who === 'here'
                ? undefined
                : who === 'other'
                  ? signedInAsOther()
                  : pauseReason('signIn')
        },
    }
}
