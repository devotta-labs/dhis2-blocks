import React, { Children, useEffect, type ReactNode } from 'react'
import type { FinderPerson } from '../api/search'
import { FinderContext } from './context'
import { isProduction } from './env'
import { useFinderController } from './useFinderController'

export interface FinderProviderProps {
    /** The program to search in. Changing it resets forms and results. */
    program: string
    /** Called with the person the user picks. */
    onSelect: (person: FinderPerson) => void
    children?: ReactNode
}

const FinderScope = ({ program, onSelect, children }: FinderProviderProps) => {
    const value = useFinderController({ program, onSelect })
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
 * Holds the finder's state and enforces the program's search rules. It
 * renders only its children, so any UI inside it can use the finder hooks.
 */
export function FinderProvider(props: FinderProviderProps) {
    // A new program starts from nothing: values, forms and results.
    return <FinderScope key={props.program} {...props} />
}
