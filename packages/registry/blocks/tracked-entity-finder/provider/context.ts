import { createContext, useContext } from 'react'
import type { FinderResourceClient } from '../api/client'
import type { FinderPerson } from '../api/search'
import type { FinderSystemInfo } from '../api/systemInfo'
import type { FinderFormApi } from '../form/finderFormApi'
import type {
    FormField,
    FormVerdict,
    ProgramModel,
    ValidatedSearch,
} from '../rules/types'

export type FinderStatus = 'loading' | 'ready' | 'error'

export type FinderResultsStatus =
    | 'idle'
    | 'searching'
    | 'results'
    | 'empty'
    | 'too-many'
    | 'error'

/** The last submitted search's answer for the current page. */
export interface FinderResultsView {
    status: FinderResultsStatus
    people: readonly FinderPerson[]
    hasNext: boolean
    /** The previous page stays on screen while the next one loads. */
    refreshing: boolean
}

export interface FinderSubmission {
    search: ValidatedSearch
    /** Grows with every Search, so each submission can be announced once. */
    id: number
}

interface FinderState {
    status: FinderStatus
    model?: ProgramModel
    submission?: FinderSubmission
    page: number
    /** Run once here, so every results part reads the same answer. */
    results: FinderResultsView
}

interface FinderActions {
    submit: (search: ValidatedSearch) => void
    setPage: (page: number) => void
    select: (person: FinderPerson) => void
    /** Logs a metadata error's full text, once per provider. */
    logMetadataError: (message: string) => void
}

interface FinderMeta {
    program: string
    client: FinderResourceClient
    info?: FinderSystemInfo
}

export interface FinderContextValue {
    state: FinderState
    actions: FinderActions
    meta: FinderMeta
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
    /** Undefined until program metadata is ready. */
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
