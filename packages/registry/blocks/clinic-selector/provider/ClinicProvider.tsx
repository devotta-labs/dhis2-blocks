import { announce } from '@/components/dhis2/ui/announcer'
import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'
import {
    cacheIdOf,
    resourceClientOf,
    shouldRetryClinicRequest,
    type ClinicClient,
} from '../api/client'
import { fetchClinicsById, fetchMe, searchClinics } from '../api/queries'
import { clinicQueryKeys } from '../api/queryKeys'
import { useClinicClient } from '../api/runtimeClient'
import type { AssignedClinic, Clinic } from '../api/schemas'
import { isWithinAssigned } from '../api/scope'
import {
    ClinicContext,
    type ClinicContextValue,
    type ClinicStatus,
} from './context'
import {
    readRemembered,
    withRecent,
    writeRemembered,
    type Remembered,
} from './remembered'

export interface ClinicProviderProps {
    /** The current clinic's id, when the host owns the choice. */
    value?: string
    /** Called with every clinic the user picks. */
    onValueChange?: (clinic: Clinic) => void
    /** A custom data engine's client; app-runtime's is the default. */
    client?: ClinicClient
    children?: ReactNode
}

/** Unwraps a Result so React Query owns the error state. */
const unwrap = <T,>(result: Result<T, Error>): T => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

// Stored ids are untrusted: only a uid may go into the by-id filter.
const UID = /^[A-Za-z][A-Za-z0-9]{10}$/
const SEARCH_DELAY_MS = 250
// More than this many facilities is too many to scan without a filter.
const MAX_UNFILTERED = 8
const NO_ASSIGNED: AssignedClinic[] = []
const NO_RECENT: Remembered = { recent: [] }
const noop = () => {}

const statusOf = ({
    failed,
    validated,
    assigned,
}: {
    failed: boolean
    validated: boolean
    assigned: AssignedClinic[]
}): ClinicStatus => {
    if (failed) {
        return 'failed'
    }
    if (!validated) {
        return 'pending'
    }
    return assigned.length === 0 ? 'none' : 'ready'
}

/**
 * Knows the user's assigned clinics, which one is current and which they
 * used recently, and searches their hierarchy. It renders only its children.
 */
export function ClinicProvider({
    value,
    onValueChange,
    client,
    children,
}: ClinicProviderProps) {
    const runtimeClient = useClinicClient()
    const chosen = client ?? runtimeClient
    const resourceClient = useMemo(() => resourceClientOf(chosen), [chosen])
    const clientId = cacheIdOf(chosen)

    const me = useQuery({
        queryKey: clinicQueryKeys.me(clientId),
        queryFn: async ({ signal }) =>
            unwrap(await fetchMe(resourceClient, signal)),
        retry: shouldRetryClinicRequest,
    })
    const userId = me.data?.userId
    const assigned = me.data?.assigned ?? NO_ASSIGNED

    // What storage held for this user, and what this provider has since written.
    const stored = useMemo(
        () => (userId === undefined ? NO_RECENT : readRemembered(userId)),
        [userId]
    )
    const [written, setWritten] = useState<{
        userId: string
        remembered: Remembered
    }>()
    const remembered =
        written !== undefined && written.userId === userId
            ? written.remembered
            : stored
    const remember = useCallback(
        (next: Remembered) => {
            if (userId === undefined) {
                return
            }
            setWritten({ userId, remembered: next })
            writeRemembered(userId, next)
        },
        [userId]
    )
    // Clinics picked here came from the hierarchy, so they need no check.
    const [picked, setPicked] = useState<ReadonlyMap<string, Clinic>>(
        () => new Map()
    )

    // Keyed on what was stored, so picking a clinic never starts a new check.
    const toCheck = useMemo(() => {
        const ids = new Set([stored.current, ...stored.recent])
        if (value !== undefined && !picked.has(value)) {
            ids.add(value)
        }
        return [...ids].filter(
            (id): id is string =>
                id !== undefined &&
                UID.test(id) &&
                !assigned.some((a) => a.id === id)
        )
    }, [stored, value, picked, assigned])
    const checking = userId !== undefined && toCheck.length > 0
    const byId = useQuery({
        queryKey: clinicQueryKeys.byId(clientId, userId ?? '', toCheck),
        queryFn: async ({ signal }) =>
            unwrap(await fetchClinicsById(resourceClient, toCheck, signal)),
        enabled: checking,
        retry: shouldRetryClinicRequest,
    })

    const checked = byId.data
    const valid = useMemo(() => {
        const inScope = (checked ?? []).filter((c) =>
            isWithinAssigned(c.path, assigned)
        )
        return new Map<string, Clinic>(
            [...picked.values(), ...inScope, ...assigned].map((c) => [c.id, c])
        )
    }, [checked, picked, assigned])

    const validated = me.isSuccess && (!checking || byId.isSuccess)
    const status = statusOf({
        failed: me.isError || (checking && byId.isError),
        validated,
        assigned,
    })

    const remembers = valid.get(remembered.current ?? '') ?? assigned[0]
    const controlled = value === undefined ? undefined : valid.get(value)
    const current = value === undefined ? remembers : controlled
    const clinic = status === 'ready' ? current : undefined

    // Written only after a successful check, so a failed one never forgets a clinic.
    useEffect(() => {
        if (!validated) {
            return
        }
        const kept = {
            current: valid.has(remembered.current ?? '')
                ? remembered.current
                : undefined,
            recent: remembered.recent.filter((id) => valid.has(id)),
        }
        if (
            kept.current !== remembered.current ||
            kept.recent.length !== remembered.recent.length
        ) {
            remember(kept)
        }
    }, [validated, valid, remembered, remember])

    const isAssigned = useCallback(
        (id: string) => assigned.some((a) => a.id === id),
        [assigned]
    )
    useEffect(() => {
        if (
            controlled !== undefined &&
            !isAssigned(controlled.id) &&
            remembered.recent[0] !== controlled.id
        ) {
            remember({
                ...remembered,
                recent: withRecent(remembered.recent, controlled.id),
            })
        }
    }, [controlled, isAssigned, remembered, remember])

    const setClinic = useCallback(
        (next: Clinic) => {
            setPicked((before) => new Map(before).set(next.id, next))
            remember({
                current: next.id,
                recent: isAssigned(next.id)
                    ? remembered.recent
                    : withRecent(remembered.recent, next.id),
            })
            onValueChange?.(next)
            announce(
                i18n.t('Clinic changed to {{name}}', {
                    name: next.displayName,
                })
            )
        },
        [remember, remembered, isAssigned, onValueChange]
    )

    const recent = useMemo(
        () =>
            remembered.recent.flatMap((id) => {
                const found = valid.get(id)
                return found && !isAssigned(id) ? [found] : []
            }),
        [remembered, valid, isAssigned]
    )

    const searchesServer = assigned.some((a) => a.hasChildren)
    const searchable = searchesServer || assigned.length > MAX_UNFILTERED
    const [query, setQuery] = useState('')
    const trimmed = query.trim()
    const [debounced, setDebounced] = useState('')
    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(trimmed), SEARCH_DELAY_MS)
        return () => clearTimeout(timeout)
    }, [trimmed])
    const server = useQuery({
        queryKey: clinicQueryKeys.search(clientId, userId ?? '', debounced),
        queryFn: async ({ signal }) =>
            unwrap(await searchClinics(resourceClient, debounced, signal)),
        enabled: searchesServer && userId !== undefined && debounced !== '',
        retry: shouldRetryClinicRequest,
    })
    const { refetch: refetchSearch } = server
    const search = useMemo((): ClinicContextValue['search'] => {
        if (!searchesServer) {
            const lower = trimmed.toLowerCase()
            return {
                status: 'ready',
                clinics: assigned.filter((a) =>
                    a.displayName.toLowerCase().includes(lower)
                ),
                hasMore: false,
                retry: noop,
            }
        }
        const retrySearch = () => void refetchSearch()
        if (trimmed === '') {
            return { status: 'idle', clinics: [], hasMore: false, retry: noop }
        }
        if (debounced !== trimmed || server.isPending) {
            return {
                status: 'pending',
                clinics: [],
                hasMore: false,
                retry: retrySearch,
            }
        }
        if (server.isError) {
            return {
                status: 'failed',
                clinics: [],
                hasMore: false,
                retry: retrySearch,
            }
        }
        return {
            status: 'ready',
            clinics: server.data.clinics,
            hasMore: server.data.hasMore,
            retry: retrySearch,
        }
    }, [
        searchesServer,
        trimmed,
        debounced,
        assigned,
        server.isPending,
        server.isError,
        server.data,
        refetchSearch,
    ])

    const { refetch: refetchMe } = me
    const { refetch: refetchById } = byId
    const meFailed = me.isError
    const byIdFailed = byId.isError
    const retry = useCallback(() => {
        if (meFailed) {
            void refetchMe()
        }
        if (byIdFailed) {
            void refetchById()
        }
    }, [meFailed, byIdFailed, refetchMe, refetchById])

    const context = useMemo<ClinicContextValue>(
        () => ({
            status,
            clinic,
            assigned,
            recent,
            searchable,
            searchesServer,
            query,
            setQuery,
            search,
            setClinic,
            retry,
        }),
        [
            status,
            clinic,
            assigned,
            recent,
            searchable,
            searchesServer,
            query,
            search,
            setClinic,
            retry,
        ]
    )

    return (
        <ClinicContext.Provider value={context}>
            {children}
        </ClinicContext.Provider>
    )
}
