import i18n from '@dhis2/d2-i18n'
import {
    useCallback,
    useContext,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
} from 'react'
import type { FinderPerson } from './api/search'
import {
    FinderPersonContext,
    useFinderContext,
    useFinderFormContext,
    type FinderResultsStatus,
    type FinderStatus,
} from './provider/context'
import { isProduction } from './provider/env'
import { describeProblem } from './rules/describeProblem'
import { attributeOf, searchableAttributes } from './rules/programModel'
import type {
    ConfigProblem,
    FieldIssue,
    FieldValue,
    FinderAttribute,
    FormField,
    FormVerdict,
} from './rules/types'

export interface FinderFieldAttribute {
    readonly label: string
    readonly valueType: string
    readonly unique: boolean
    readonly options?: ReadonlyArray<{
        readonly code: string
        readonly name: string
    }>
}

export interface FinderFieldState {
    /** The program attribute, once metadata is loaded and if it exists. */
    attribute?: FinderFieldAttribute
    value?: FieldValue
    setValue: (value: FieldValue) => void
    /** Why the entered value cannot be searched as is. */
    issue?: FieldIssue
    /** Set when the field does not fit the program; it is left out of the search. */
    problem?: string
}

/**
 * The text to show for a config problem: the full message in development, a
 * short one in production, where the full message is logged instead.
 */
export const useProblemMessage = (
    problem: ConfigProblem | undefined
): string | undefined => {
    const { state, actions } = useFinderContext()
    const full =
        problem && state.model
            ? describeProblem(state.model, problem)
            : undefined
    const production = isProduction()
    useEffect(() => {
        if (full && production) {
            actions.logProblem(full)
        }
    }, [full, production, actions])
    if (!full) {
        return undefined
    }
    return production ? i18n.t("This search isn't set up correctly") : full
}

const valueOf = (values: Readonly<Record<string, FieldValue>>, id: string) =>
    Object.hasOwn(values, id) ? values[id] : undefined

/** Internal: a field registered in the current form, with its attribute. */
export const useComposedField = (
    id: string,
    match: FormField['match']
): FinderFieldState & { found?: FinderAttribute } => {
    const { state, actions } = useFinderContext()
    const { formId, verdict } = useFinderFormContext()
    const key = useId()
    const { register, setValue: setFieldValue } = actions

    useLayoutEffect(
        () => register(formId, key, { attribute: id, match }),
        [register, formId, key, id, match]
    )

    const configProblem = verdict?.problems.find(
        (problem) =>
            problem.kind !== 'form-cannot-search' && problem.attribute === id
    )
    const problem = useProblemMessage(configProblem)
    const found = state.model ? attributeOf(state.model, id) : undefined
    const attribute = useMemo(
        () =>
            found &&
            Object.freeze({
                label: found.label,
                valueType: found.valueType,
                unique: found.unique,
                ...(found.options && { options: found.options }),
            }),
        [found]
    )
    const setValue = useCallback(
        (value: FieldValue) => setFieldValue(id, value),
        [setFieldValue, id]
    )
    const issues = verdict?.issues ?? {}
    return {
        found,
        attribute,
        value: valueOf(state.values, id),
        setValue,
        issue: Object.hasOwn(issues, id) ? issues[id] : undefined,
        problem,
    }
}

const publicField = ({
    found: _found,
    ...field
}: ReturnType<typeof useComposedField>): FinderFieldState => field

/** A field searched by exact value. Use inside `FinderForm`. */
export const useFinderField = (attribute: string): FinderFieldState =>
    publicField(useComposedField(attribute, 'exact'))

/** A From–To field for a number or date attribute. Use inside `FinderForm`. */
export const useFinderRangeField = (attribute: string): FinderFieldState =>
    publicField(useComposedField(attribute, 'range'))

export interface FinderSearchState {
    canSearch: boolean
    /** Details still needed to reach the program's minimum. */
    missing: number
    reason: FormVerdict['reason']
    /** The label of the ID that searches alone. */
    searchingBy?: string
    submit: () => void
}

/** The current form's search: whether it can run, and running it. */
export const useFinderSearch = (): FinderSearchState => {
    const { state, actions } = useFinderContext()
    const { verdict } = useFinderFormContext()
    const search = state.status === 'ready' ? verdict?.search : undefined
    const { submit: submitSearch } = actions
    const submit = useCallback(() => {
        if (search) {
            submitSearch(search)
        }
    }, [search, submitSearch])
    const searchingBy =
        verdict?.searchingBy && state.model
            ? attributeOf(state.model, verdict.searchingBy)?.label
            : undefined
    return {
        canSearch: search !== undefined,
        missing: verdict?.missing ?? 0,
        reason:
            verdict?.reason ??
            (state.status === 'error' ? 'not-set-up' : 'empty'),
        searchingBy,
        submit,
    }
}

export interface FinderProgramAttribute {
    readonly id: string
    readonly label: string
    readonly valueType: string
    readonly unique: boolean
}

export interface FinderProgramState {
    readonly status: FinderStatus
    readonly name?: string
    readonly searchableAttributes: ReadonlyArray<FinderProgramAttribute>
}

/** The program's name and searchable attributes, read-only. */
export const useFinderProgram = (): FinderProgramState => {
    const { state } = useFinderContext()
    const { status, model } = state
    return useMemo(
        () =>
            Object.freeze({
                status,
                name: model?.name,
                searchableAttributes: Object.freeze(
                    (model ? searchableAttributes(model) : []).map(
                        ({ id, label, valueType, unique }) =>
                            Object.freeze({ id, label, valueType, unique })
                    )
                ),
            }),
        [status, model]
    )
}

export type { FinderResultsStatus }

export interface FinderResultsState {
    status: FinderResultsStatus
    /** The people on the current page. */
    people: readonly FinderPerson[]
    page: number
    hasNext: boolean
    hasPrevious: boolean
    /** The previous page stays on screen while the next one loads. */
    refreshing: boolean
    next: () => void
    previous: () => void
    select: (person: FinderPerson) => void
}

/** The last submitted search's results, and paging through them. */
export const useFinderResults = (): FinderResultsState => {
    const { state, actions } = useFinderContext()
    const { page } = state
    const { status, people, hasNext, refreshing } = state.results
    const { setPage, select } = actions
    const next = useCallback(() => setPage(page + 1), [setPage, page])
    const previous = useCallback(
        () => setPage(Math.max(1, page - 1)),
        [setPage, page]
    )
    return {
        status,
        people,
        page,
        hasNext,
        hasPrevious: status === 'results' && page > 1,
        refreshing,
        next,
        previous,
        select,
    }
}

/** The person of the current `FinderList` item, for custom row content. */
export const useFinderPerson = (): FinderPerson => {
    const person = useContext(FinderPersonContext)
    if (!person) {
        throw new Error('useFinderPerson must be used inside FinderList')
    }
    return person
}
