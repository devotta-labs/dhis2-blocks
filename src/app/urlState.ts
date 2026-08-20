import { z } from 'zod'
import { WorkingListUrlStateSchema } from '@/working-list/domain/schemas'

export type AppUrlState = z.infer<typeof WorkingListUrlStateSchema>

const ALLOWED_KEYS = [
    'programId',
    'orgUnitId',
    'selectedTemplateId',
    'page',
    'pageSize',
] as const

const SingleUrlParameterSchema = z.array(z.string()).length(1)

export const parseAppUrlState = (parameters: URLSearchParams): AppUrlState => {
    const candidate = Object.fromEntries(
        ALLOWED_KEYS.flatMap((key) => {
            if (!parameters.has(key)) {
                return []
            }
            const [value] = SingleUrlParameterSchema.parse(
                parameters.getAll(key)
            )
            return [[key, value]]
        })
    )
    return WorkingListUrlStateSchema.parse(candidate)
}

/* react-router applies navigations to window.location synchronously but
   commits the matching React state in a transition. Incremental updates
   must merge against the live URL, not the possibly stale committed one,
   or two quick writes (select template, then reset page) lose the first. */
export const parseAppUrlStateFromHash = (hash: string): AppUrlState => {
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    return parseAppUrlState(new URLSearchParams(query))
}

export const serializeAppUrlState = (state: AppUrlState) => {
    const validated = WorkingListUrlStateSchema.parse(state)
    const parameters = new URLSearchParams()
    for (const key of ALLOWED_KEYS) {
        const value = validated[key]
        if (value !== undefined) {
            parameters.set(key, String(value))
        }
    }
    return parameters.toString()
}

export const isGuardedAppUrlTransition = (
    current: AppUrlState,
    next: AppUrlState
) =>
    current.programId !== next.programId ||
    current.selectedTemplateId !== next.selectedTemplateId
