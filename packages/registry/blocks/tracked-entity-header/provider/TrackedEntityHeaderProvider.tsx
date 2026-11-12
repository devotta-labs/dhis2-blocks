import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { useConfig } from '@dhis2/app-runtime'
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from 'react'
import { displayLocale } from '../format/display'
import { HeaderContext, type HeaderContextValue } from './context'

export interface TrackedEntityHeaderProviderProps {
    /** The tracked entity the banner shows. */
    trackedEntity: string
    /** The program whose attributes, enrollment and owner the banner shows; without one, the tracked entity type's. */
    program?: string
    children?: ReactNode
}

/** A blank program is no program. */
const normaliseProgram = (program: string | undefined) =>
    program?.trim() || undefined

/** The system calendar and the user's locale, for every date and number shown. */
const useDisplayOptions = (): HeaderContextValue['display'] => {
    const { systemInfo } = useConfig()
    // `calendar` is in every server's systemInfo, though app-runtime's type leaves it out.
    const calendar = parseDhis2Calendar(
        systemInfo && 'calendar' in systemInfo ? systemInfo.calendar : undefined
    )
    const locale = displayLocale()
    return useMemo(() => ({ calendar, locale }), [calendar, locale])
}

const MISSING_ID =
    'TrackedEntityHeaderProvider needs a trackedEntity id; it shows loading until it has one'

const HeaderScope = ({
    trackedEntity,
    program,
    children,
}: TrackedEntityHeaderProviderProps) => {
    const teId = trackedEntity.trim()
    const progId = normaliseProgram(program)
    const display = useDisplayOptions()

    const logged = useRef(new Set<string>())
    const logProblem = useCallback((message: string) => {
        if (!logged.current.has(message)) {
            logged.current.add(message)
            console.error(message)
        }
    }, [])

    useEffect(() => {
        if (teId === '') {
            logProblem(MISSING_ID)
        }
    }, [teId, logProblem])

    const [counts, setCounts] = useState<ReadonlyMap<string, number>>(
        () => new Map()
    )
    const [typeCounts, setTypeCounts] = useState<ReadonlyMap<string, number>>(
        () => new Map()
    )
    const placeAttribute = useMemo(() => countedPlacement(setCounts), [])
    const placeRelationshipType = useMemo(
        () => countedPlacement(setTypeCounts),
        []
    )
    const placed = useMemo<ReadonlySet<string>>(
        () => new Set(counts.keys()),
        [counts]
    )
    const relationshipTypes = useMemo<ReadonlySet<string>>(
        () => new Set(typeCounts.keys()),
        [typeCounts]
    )

    const value = useMemo<HeaderContextValue>(
        () => ({
            trackedEntity: teId,
            program: progId,
            display,
            logProblem,
            placeAttribute,
            placed,
            placeRelationshipType,
            relationshipTypes,
        }),
        [
            teId,
            progId,
            display,
            logProblem,
            placeAttribute,
            placed,
            placeRelationshipType,
            relationshipTypes,
        ]
    )

    return (
        <HeaderContext.Provider value={value}>
            {children}
        </HeaderContext.Provider>
    )
}

/** A placement function over a counted map: each call adds one for `uid`, its undo takes it away. */
const countedPlacement =
    (set: Dispatch<SetStateAction<ReadonlyMap<string, number>>>) =>
    (uid: string) => {
        const bump = (by: number) =>
            set((current) => {
                const next = new Map(current)
                const count = (next.get(uid) ?? 0) + by
                if (count > 0) {
                    next.set(uid, count)
                } else {
                    next.delete(uid)
                }
                return next
            })
        bump(1)
        return () => bump(-1)
    }

/**
 * Says which tracked entity, in which program, the parts inside show. The parts
 * load it themselves, once between them. It renders only its children.
 */
export function TrackedEntityHeaderProvider(
    props: TrackedEntityHeaderProviderProps
) {
    // Another tracked entity or program starts from nothing: what was open, placed
    // or logged belonged to the previous record. Its values never show while the
    // new ones load either way, since the requests are keyed by both ids.
    return (
        <HeaderScope
            key={`${props.trackedEntity}:${normaliseProgram(props.program) ?? ''}`}
            {...props}
        />
    )
}
