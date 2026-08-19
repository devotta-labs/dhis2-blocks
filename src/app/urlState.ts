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

const getParameters = (location: Pick<Location, 'hash' | 'search'>) => {
    const hashQuery = location.hash.includes('?')
        ? location.hash.slice(location.hash.indexOf('?') + 1)
        : ''
    return new URLSearchParams(hashQuery || location.search)
}

export const parseAppUrlState = (
    location?: Pick<Location, 'hash' | 'search'>
): AppUrlState => {
    if (!location) {
        return {}
    }
    const parameters = getParameters(location)
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

const updateBrowserUrl = (
    state: AppUrlState,
    method: 'pushState' | 'replaceState'
) => {
    if (typeof window === 'undefined') {
        return
    }
    const query = serializeAppUrlState(state)
    const base = window.location.pathname
    const nextUrl = `${base}#/${query ? `?${query}` : ''}`
    window.history[method](null, '', nextUrl)
}

export const writeAppUrlState = (state: AppUrlState) =>
    updateBrowserUrl(state, 'pushState')

export const replaceAppUrlState = (state: AppUrlState) =>
    updateBrowserUrl(state, 'replaceState')

export const isGuardedAppUrlTransition = (
    current: AppUrlState,
    next: AppUrlState
) =>
    current.programId !== next.programId ||
    current.selectedTemplateId !== next.selectedTemplateId
