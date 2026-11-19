import { announce } from '@/components/dhis2/ui/announcer'
import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
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
import { fetchClinicsById, fetchMe, FRESH_MS, unwrap } from '../api/queries'
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

// Stored ids are untrusted: only a uid may go into the by-id filter.
const UID = /^[A-Za-z][A-Za-z0-9]{10}$/
const NO_ASSIGNED: AssignedClinic[] = []

/** Everything that belongs to one user, so a different user starts afresh. */
interface UserState {
    userId?: string
    remembered: Remembered
    /** Every id picked or checked: its clinic, or null when the server did not return it. */
    known: ReadonlyMap<string, Clinic | null>
}

const startFor = (userId?: string): UserState => ({
    userId,
    remembered: userId === undefined ? { recent: [] } : readRemembered(userId),
    known: new Map(),
})

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
 * used recently. It renders only its children.
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
    const cacheId = cacheIdOf(chosen)

    const me = useQuery({
        queryKey: clinicQueryKeys.me(cacheId),
        queryFn: async ({ signal }) =>
            unwrap(await fetchMe(resourceClient, signal)),
        retry: shouldRetryClinicRequest,
        staleTime: FRESH_MS,
    })
    const userId = me.data?.userId
    const assigned = me.data?.assigned ?? NO_ASSIGNED

    const [user, setUser] = useState(() => startFor(userId))
    if (user.userId !== userId) {
        setUser(startFor(userId))
    }
    const { remembered, known } = user
    const update = useCallback(
        (change: (before: UserState) => Partial<UserState>) =>
            setUser((before) =>
                before.userId === userId
                    ? { ...before, ...change(before) }
                    : before
            ),
        [userId]
    )
    const remember = useCallback(
        (next: Remembered) => {
            if (userId === undefined) {
                return
            }
            update(() => ({ remembered: next }))
            writeRemembered(userId, next)
        },
        [userId, update]
    )
    const isAssigned = useCallback(
        (id: string) => assigned.some((a) => a.id === id),
        [assigned]
    )

    // Only ids never checked, so an id leaving the set never starts a new check.
    const toCheck = useMemo(
        () =>
            [
                ...new Set([remembered.current, ...remembered.recent, value]),
            ].filter(
                (id): id is string =>
                    id !== undefined &&
                    UID.test(id) &&
                    !isAssigned(id) &&
                    !known.has(id)
            ),
        [remembered, value, known, isAssigned]
    )
    const checking = userId !== undefined && toCheck.length > 0
    const byId = useQuery({
        queryKey: clinicQueryKeys.byId(cacheId, userId ?? '', toCheck),
        queryFn: async ({ signal }) =>
            unwrap(await fetchClinicsById(resourceClient, toCheck, signal)),
        enabled: checking,
        retry: shouldRetryClinicRequest,
        // Asked again on every mount, whatever the host's defaults: access can be lost between visits.
        staleTime: 0,
        refetchOnMount: 'always',
    })

    // Only an answer fetched by this mount counts: one left in the cache by an earlier visit may be out of date.
    const answer =
        byId.isFetchedAfterMount && byId.isSuccess ? byId.data : undefined
    useEffect(() => {
        if (answer !== undefined) {
            update((before) => {
                const next = new Map(before.known)
                toCheck.forEach((id) => next.set(id, null))
                answer.forEach((c) => next.set(c.id, c))
                return { known: next }
            })
        }
    }, [answer, toCheck, update])

    const valid = useMemo(() => {
        const inScope = [...known.values(), ...(answer ?? [])].filter(
            (c): c is Clinic => c !== null && isWithinAssigned(c.path, assigned)
        )
        return new Map<string, Clinic>(
            [...inScope, ...assigned].map((c) => [c.id, c])
        )
    }, [known, answer, assigned])

    // Data held through a failed refetch still counts: a background failure never blanks the clinic.
    // A check that cannot be made leaves its clinics unknown; the user's own clinics still work.
    const unchecked = checking && byId.isError && answer === undefined
    const validated =
        me.data !== undefined &&
        (!checking || answer !== undefined || unchecked)
    const status = statusOf({
        failed: me.isError && me.data === undefined,
        validated,
        assigned,
    })

    // An unknown remembered clinic is neither shown nor replaced: the user chooses, or the check succeeds later.
    const awaitsCheck =
        unchecked &&
        remembered.current !== undefined &&
        !valid.has(remembered.current)
    const remembers =
        valid.get(remembered.current ?? '') ??
        (awaitsCheck ? undefined : assigned[0])
    const controlled = value === undefined ? undefined : valid.get(value)
    const current = value === undefined ? remembers : controlled
    const clinic = status === 'ready' ? current : undefined

    // Written only after a successful check, so a failed one never forgets a clinic.
    useEffect(() => {
        if (!validated || unchecked) {
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
    }, [validated, unchecked, valid, remembered, remember])

    // The host's clinic is remembered, whether a pick or the host itself changed it.
    useEffect(() => {
        if (controlled === undefined) {
            return
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
    }, [controlled, isAssigned, remembered, remember])

    // Every change after the first clinic is announced, whoever made it.
    const said = useRef<{ userId?: string; id: string }>()
    useEffect(() => {
        if (clinic === undefined) {
            return
        }
        const before = said.current
        said.current = { userId, id: clinic.id }
        if (before && before.userId === userId && before.id !== clinic.id) {
            announce(
                i18n.t('Clinic changed to {{name}}', {
                    name: clinic.displayName,
                    interpolation: { escapeValue: false },
                })
            )
        }
    }, [clinic, userId])

    const setClinic = useCallback(
        (next: Clinic) => {
            // Nothing to pick from before the clinics load, and nothing from outside the user's.
            if (
                status !== 'ready' ||
                // Choosing the current clinic again changes nothing, so nothing is said or called.
                next.id === clinic?.id ||
                !isWithinAssigned(next.path, assigned)
            ) {
                return
            }
            // A picked clinic needs no check.
            update((before) => ({
                known: new Map(before.known).set(next.id, next),
            }))
            if (value === undefined) {
                remember({
                    current: next.id,
                    recent: isAssigned(next.id)
                        ? remembered.recent
                        : withRecent(remembered.recent, next.id),
                })
            }
            onValueChange?.(next)
        },
        [
            status,
            clinic,
            assigned,
            value,
            update,
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
            state: { status, clinic, assigned, recent },
            actions: { setClinic, retry },
            source: { client: resourceClient, cacheId, userId },
        }),
        [
            status,
            clinic,
            assigned,
            recent,
            setClinic,
            retry,
            resourceClient,
            cacheId,
            userId,
        ]
    )

    return (
        <ClinicContext.Provider value={context}>
            {children}
        </ClinicContext.Provider>
    )
}
