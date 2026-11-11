import React, {
    Children,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'
import type { FinderPerson } from '../api/search'
import { FinderContext, type FinderSubmission } from './context'
import { isProduction } from './env'

export interface FinderProviderProps {
    /** The program to search in. Changing it resets forms and results. */
    program: string
    /** Called with the person the user picks. */
    onSelect: (person: FinderPerson) => void
    children?: ReactNode
}

const FinderScope = ({ program, onSelect, children }: FinderProviderProps) => {
    const [submission, setSubmission] = useState<FinderSubmission>()
    const value = useMemo(
        () => ({ program, onSelect, submission, setSubmission }),
        [program, onSelect, submission]
    )
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
 * Holds the search the user ran, shared by the forms and results inside it.
 * It renders only its children, so any UI inside it can use the finder hooks.
 */
export function FinderProvider(props: FinderProviderProps) {
    // A new program starts from nothing: values, forms and results.
    return <FinderScope key={props.program} {...props} />
}
