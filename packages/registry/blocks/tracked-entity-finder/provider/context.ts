import { createContext, useContext } from 'react'
import type { FinderPerson } from '../api/search'
import type { FinderFormApi } from '../form/finderFormApi'
import type { FormField, FormVerdict, ValidatedSearch } from '../rules/types'

/** A search the user ran, and the page of its results on screen. */
export interface FinderSubmission {
    search: ValidatedSearch
    /** When Search was pressed, so the same search can run again. */
    submittedAt: number
    page: number
}

/** What the finder's parts share; server data they load themselves. */
export interface FinderContextValue {
    program: string
    onSelect: (person: FinderPerson) => void
    /** The last submitted search, of whichever form ran it. */
    submission?: FinderSubmission
    setSubmission: (submission: FinderSubmission) => void
}

/** Internal: never exported from the block, so it cannot be swapped out. */
export const FinderContext = createContext<FinderContextValue | null>(null)

export const useFinderContext = (): FinderContextValue => {
    const context = useContext(FinderContext)
    if (!context) {
        throw new Error(
            'Finder parts and hooks must be rendered inside FinderProvider'
        )
    }
    return context
}

export interface FinderFormContextValue {
    /** Adds a field to this form; returns the function that removes it. */
    register: (key: string, field: FormField) => () => void
    /** This form's TanStack form: its values, field meta and submit. */
    form: FinderFormApi
    /** Set once the user tried to search, so every field error shows. */
    submitted: boolean
    /** Undefined until program metadata has loaded. */
    verdict?: FormVerdict
}

export const FinderFormContext = createContext<FinderFormContextValue | null>(
    null
)

export const useFinderFormContext = (): FinderFormContextValue => {
    const context = useContext(FinderFormContext)
    if (!context) {
        throw new Error(
            'FinderField, FinderRangeField, FinderHint, FinderSubmit, useFinderField, useFinderRangeField and useFinderSearch must be rendered inside FinderForm'
        )
    }
    return context
}

/** The person a `FinderList` item renders. */
export const FinderPersonContext = createContext<FinderPerson | null>(null)
