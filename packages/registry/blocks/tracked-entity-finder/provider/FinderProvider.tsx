import React, { Children, useEffect, useMemo, type ReactNode } from 'react'
import type { FinderPerson } from '../api/search'
import type { FinderScope as SearchScope } from '../rules/types'
import { FinderContext } from './context'
import { isProduction } from './env'
import { useFinderController } from './useFinderController'

/** Where to search: a program, or a tracked entity type without a program. */
type FinderProviderScope =
    | {
          /** The program to search in. Changing it resets forms and results. */
          program: string
          trackedEntityType?: never
      }
    | {
          program?: never
          /**
           * The tracked entity type to search without a program, by its own
           * searchable attributes and search settings. Changing it resets
           * forms and results.
           */
          trackedEntityType: string
      }

export type FinderProviderProps = FinderProviderScope & {
    /** Called with the person the user picks. */
    onSelect: (person: FinderPerson) => void
    children?: ReactNode
}

const toScope = (
    program: string | undefined,
    trackedEntityType: string | undefined
): SearchScope => {
    if (program) {
        return { kind: 'program', id: program }
    }
    if (trackedEntityType) {
        return { kind: 'trackedEntityType', id: trackedEntityType }
    }
    throw new Error('FinderProvider needs a program or a trackedEntityType')
}

const FinderScope = ({
    scope,
    onSelect,
    children,
}: Pick<FinderProviderProps, 'onSelect' | 'children'> & {
    scope: SearchScope
}) => {
    const value = useFinderController({ scope, onSelect })
    const empty = Children.count(children) === 0

    useEffect(() => {
        if (empty && !isProduction()) {
            console.warn(
                'FinderProvider has no children: compose a FinderForm with FinderField parts and FinderResults inside it.'
            )
        }
    }, [empty])

    return (
        <FinderContext.Provider value={value}>
            {children}
        </FinderContext.Provider>
    )
}

/**
 * Holds the finder's state and enforces the search rules of the program, or
 * of the tracked entity type without a program. It renders only its
 * children, so any UI inside it can use the finder hooks.
 */
export function FinderProvider({
    program,
    trackedEntityType,
    onSelect,
    children,
}: FinderProviderProps) {
    const scope = useMemo(
        () => toScope(program, trackedEntityType),
        [program, trackedEntityType]
    )
    // A new scope starts from nothing: values, forms and results.
    return (
        <FinderScope
            key={`${scope.kind}:${scope.id}`}
            scope={scope}
            onSelect={onSelect}
        >
            {children}
        </FinderScope>
    )
}
