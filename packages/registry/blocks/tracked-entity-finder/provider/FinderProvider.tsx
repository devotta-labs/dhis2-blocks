import React, { Children, useEffect, type ReactNode } from 'react'
import {
    cacheIdOf,
    resourceClientOf,
    type TrackedEntityFinderClient,
} from '../api/client'
import type { FinderPerson } from '../api/search'
import { useTrackedEntityFinderClient } from '../api/runtimeClient'
import { FinderContext } from './context'
import { isProduction } from './env'
import { useFinderController } from './useFinderController'

export interface FinderProviderProps {
    /** The program to search in. Changing it resets forms and results. */
    program: string
    /** Called with the person the user picks. */
    onSelect: (person: FinderPerson) => void
    /** A custom data engine's client; app-runtime's is the default. */
    client?: TrackedEntityFinderClient
    children?: ReactNode
}

const FinderScope = ({
    program,
    onSelect,
    client,
    children,
}: FinderProviderProps & { client: TrackedEntityFinderClient }) => {
    const value = useFinderController({ program, onSelect, client })
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

const RuntimeFinderScope = (props: FinderProviderProps) => {
    const client = useTrackedEntityFinderClient()
    return (
        <FinderScope
            key={`${cacheIdOf(resourceClientOf(client))}:${props.program}`}
            {...props}
            client={client}
        />
    )
}

/**
 * Holds the finder's state and enforces the program's search rules. It
 * renders only its children, so any UI inside it can use the finder hooks.
 */
export function FinderProvider(props: FinderProviderProps) {
    if (props.client) {
        return (
            <FinderScope
                key={`${cacheIdOf(resourceClientOf(props.client))}:${props.program}`}
                {...props}
                client={props.client}
            />
        )
    }
    return <RuntimeFinderScope key={props.program} {...props} />
}
