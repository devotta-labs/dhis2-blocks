import { FetchError } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import type { DataEngine } from '@/components/spreadsheet'
import { classify } from '../outbox/failure'
import { SAVE_TIMEOUT, withinLimit } from '../sources/trackerSave'
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
    const signedIn: () => Promise<'here' | 'other' | 'lapsed'> = async () => {
        let id: string
        try {
            id = meSchema.parse(
                await withinLimit(SAVE_TIMEOUT, (signal) =>
                    engine.query(ME_QUERY, { signal })
                )
            ).me.id
        } catch (error) {
            if (
                error instanceof FetchError &&
                classify(error).kind === 'signIn'
            ) {
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
        notNow: async () => {
            if (!navigator.onLine) {
                return pauseReason('offline')
            }
            const who = await signedIn()
            if (who === 'here') {
                return undefined
            }
            return who === 'other' ? signedInAsOther() : pauseReason('signIn')
        },
    }
}
