import { announce } from '@/components/dhis2/ui/announcer'
import i18n from '@dhis2/d2-i18n'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import {
    cacheIdOf,
    resourceClientOf,
    shouldRetryClinicRequest,
    type ClinicClient,
} from '../api/client'
import { AS_IS } from '../asIs'
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
const NO_CLINICS: ReadonlyMap<string, Clinic | null> = new Map()
const noop = () => {}
const NO_MORE = {
    hasMore: false,
    loadingMore: false,
    moreFailed: false,
    loadMore: noop,
}

const announceChange = (clinic: Clinic) =>
    announce(
        i18n.t('Clinic changed to {{name}}', {
            name: clinic.displayName,
            interpolation: AS_IS,
        })
    )

/** State that belongs to one user, so a different user never sees it. */
interface ForUser<T> {
    userId: string
    value: T
}

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
    // Clinics picked here need no request, but still only count inside the assigned paths.
    const [picked, setPicked] = useState<ForUser<ReadonlyMap<string, Clinic>>>()
    // Every id already checked: its clinic, or null when the server did not return it, so it stays invalid for the session.
    const [known, setKnown] =
        useState<ForUser<ReadonlyMap<string, Clinic | null>>>()
    const pickedClinics =
        picked !== undefined && picked.userId === userId
            ? picked.value
            : NO_CLINICS
    const knownClinics =
        known !== undefined && known.userId === userId
            ? known.value
            : NO_CLINICS

    // Only ids never checked, so an id leaving the set never starts a new check.
    const toCheck = useMemo(() => {
        const ids = new Set([stored.current, ...stored.recent, value])
        return [...ids].filter(
            (id): id is string =>
                id !== undefined &&
                UID.test(id) &&
                !assigned.some((a) => a.id === id) &&
                !pickedClinics.has(id) &&
                !knownClinics.has(id)
        )
    }, [stored, value, pickedClinics, knownClinics, assigned])
    const checking = userId !== undefined && toCheck.length > 0
    const byId = useQuery({
        queryKey: clinicQueryKeys.byId(clientId, userId ?? '', toCheck),
        queryFn: async ({ signal }) =>
            unwrap(await fetchClinicsById(resourceClient, toCheck, signal)),
        enabled: checking,
        retry: shouldRetryClinicRequest,
    })

    const answer = byId.data
    useEffect(() => {
        if (answer === undefined || userId === undefined) {
            return
        }
        setKnown((before) => {
            const next = new Map(before?.userId === userId ? before.value : [])
            toCheck.forEach((id) => next.set(id, null))
            answer.forEach((c) => next.set(c.id, c))
            return { userId, value: next }
        })
    }, [answer, toCheck, userId])

    const valid = useMemo(() => {
        const inScope = [
            ...pickedClinics.values(),
            ...knownClinics.values(),
            ...(answer ?? []),
        ].filter(
            (c): c is Clinic => c !== null && isWithinAssigned(c.path, assigned)
        )
        return new Map<string, Clinic>(
            [...inScope, ...assigned].map((c) => [c.id, c])
        )
    }, [pickedClinics, knownClinics, answer, assigned])

    // Data held through a failed refetch still counts: a background failure never blanks the clinic.
    const validated =
        me.data !== undefined && (!checking || answer !== undefined)
    const status = statusOf({
        failed:
            (me.isError && me.data === undefined) ||
            (checking && byId.isError && answer === undefined),
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
    // The host's clinic is remembered, and announced when it changes, whether a pick or the host itself changed it.
    const shown = useRef<ForUser<string>>()
    useEffect(() => {
        if (controlled === undefined || userId === undefined) {
            return
        }
        const before = shown.current
        shown.current = { userId, value: controlled.id }
        if (before?.userId === userId && before.value !== controlled.id) {
            announceChange(controlled)
        }
        const recent =
            isAssigned(controlled.id) || remembered.recent[0] === controlled.id
                ? remembered.recent
                : withRecent(remembered.recent, controlled.id)
        if (
            remembered.current !== controlled.id ||
            recent !== remembered.recent
        ) {
            remember({ current: controlled.id, recent })
        }
    }, [controlled, userId, isAssigned, remembered, remember])

    const setClinic = useCallback(
        (next: Clinic) => {
            // Nothing to pick from before the clinics load, and nothing from outside the user's.
            if (
                status !== 'ready' ||
                userId === undefined ||
                !isWithinAssigned(next.path, assigned)
            ) {
                return
            }
            setPicked((before) => ({
                userId,
                value: new Map(
                    before?.userId === userId ? before.value : []
                ).set(next.id, next),
            }))
            if (value === undefined) {
                remember({
                    current: next.id,
                    recent: isAssigned(next.id)
                        ? remembered.recent
                        : withRecent(remembered.recent, next.id),
                })
                announceChange(next)
            }
            onValueChange?.(next)
        },
        [
            status,
            userId,
            assigned,
            value,
            remember,
            remembered,
            isAssigned,
            onValueChange,
        ]
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
    // A blank query pages through the whole hierarchy, so the menu can be browsed without typing.
    const server = useInfiniteQuery({
        queryKey: clinicQueryKeys.search(clientId, userId ?? '', debounced),
        queryFn: async ({ pageParam, signal }) =>
            unwrap(
                await searchClinics(
                    resourceClient,
                    debounced,
                    pageParam,
                    signal
                )
            ),
        initialPageParam: 1,
        getNextPageParam: (last, pages) =>
            last.hasMore ? pages.length + 1 : undefined,
        enabled: searchesServer && userId !== undefined,
        retry: shouldRetryClinicRequest,
    })
    const { refetch: refetchSearch, fetchNextPage } = server
    const search = useMemo((): ClinicContextValue['search'] => {
        if (!searchesServer) {
            const lower = trimmed.toLowerCase()
            return {
                status: 'ready',
                clinics: assigned.filter((a) =>
                    a.displayName.toLowerCase().includes(lower)
                ),
                ...NO_MORE,
                retry: noop,
            }
        }
        const retrySearch = () => void refetchSearch()
        if (debounced !== trimmed || server.isPending) {
            return {
                status: 'pending',
                clinics: [],
                ...NO_MORE,
                retry: retrySearch,
            }
        }
        if (server.data === undefined) {
            return {
                status: 'failed',
                clinics: [],
                ...NO_MORE,
                retry: retrySearch,
            }
        }
        // By id, so a clinic that moved between pages while they loaded shows once.
        const loaded = new Map(
            server.data.pages
                .flatMap((page) => page.clinics)
                // A server that ignores the scope filter must not list clinics a pick would drop.
                .filter((c) => isWithinAssigned(c.path, assigned))
                .map((c) => [c.id, c])
        )
        return {
            status: 'ready',
            clinics: [...loaded.values()],
            hasMore: server.hasNextPage,
            loadingMore: server.isFetchingNextPage,
            moreFailed: server.isFetchNextPageError,
            loadMore: () => void fetchNextPage(),
            retry: retrySearch,
        }
    }, [
        searchesServer,
        trimmed,
        debounced,
        assigned,
        server.isPending,
        server.data,
        server.hasNextPage,
        server.isFetchingNextPage,
        server.isFetchNextPageError,
        refetchSearch,
        fetchNextPage,
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
