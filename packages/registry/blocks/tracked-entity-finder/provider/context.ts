import { createContext, useContext } from 'react'
import type { FinderResourceClient } from '../api/client'
import type { FinderPerson } from '../api/search'
import type { FinderSystemInfo } from '../api/systemInfo'
import type {
    FieldValue,
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
    /** Grows with every Search, so the same search can run again. */
    id: number
}

export interface FinderState {
    status: FinderStatus
    model?: ProgramModel
    /** Keyed by attribute id; the same id in two forms shares its value. */
    values: Readonly<Record<string, FieldValue>>
    /** Every registration under the provider, for exact/range conflicts. */
    fields: readonly FormField[]
    /** Each form's registrations, keyed by form id. */
    forms: Readonly<Record<string, readonly FormField[]>>
    submission?: FinderSubmission
    page: number
    /** Run once here, so every results part reads the same answer. */
    results: FinderResultsView
}

export interface FinderActions {
    setValue: (id: string, value: FieldValue) => void
    /** Returns the unregister function. */
    register: (formId: string, key: string, field: FormField) => () => void
    submit: (search: ValidatedSearch) => void
    setPage: (page: number) => void
    select: (person: FinderPerson) => void
    /** Logs a config problem's full text, once per provider. */
    logProblem: (message: string) => void
}

export interface FinderMeta {
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
    formId: string
    /** This form's registrations. */
    fields: readonly FormField[]
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
            'FinderField and field hooks must be rendered inside FinderForm'
        )
    }
    return context
}

/** The person a `FinderList` item renders. */
export const FinderPersonContext = createContext<FinderPerson | null>(null)
