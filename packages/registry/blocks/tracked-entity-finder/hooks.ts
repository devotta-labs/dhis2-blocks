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
    useFinderFieldApi,
    type FinderFieldApi,
    type FinderFormApi,
} from './form/finderFormApi'
import {
    FinderPersonContext,
    useFinderContext,
    useFinderFormContext,
    type FinderResultsStatus,
    type FinderStatus,
} from './provider/context'
import { isProduction } from './provider/env'
import { describeMetadataError } from './rules/describeMetadataError'
import { attributeOf, searchableAttributes } from './rules/programModel'
import type {
    FieldKind,
    FinderAttribute,
    FormField,
    FormVerdict,
    MetadataError,
} from './rules/types'

interface FinderFieldAttribute {
    /**
     * The `FieldValue` shape to send: `text`, `option` (an option set, even on
     * a TEXT attribute), `multiText` (a MULTI_TEXT option set: `codes`, all
     * of which the person must have), `number`, `boolean`, `trueOnly`, `date`
     * (also for `dateTime`); a range field sends `numberRange` or `dateRange`.
     * `unsupported` attributes cannot be searched; MULTI_TEXT is unsupported
     * before DHIS2 2.43.
     */
    readonly kind: FieldKind
    readonly label: string
    readonly valueType: string
    readonly unique: boolean
    readonly options?: ReadonlyArray<{
        readonly code: string
        readonly name: string
    }>
}

export interface FinderFieldState {
    /**
     * The attribute's TanStack field. Read `field.state.value`, and call
     * `field.handleChange` and `field.handleBlur` from your input.
     */
    field: FinderFieldApi
    /** The program attribute, once metadata is loaded and if it exists. */
    attribute?: FinderFieldAttribute
    /**
     * Why the entered value cannot be searched, as text to show. Set once the
     * field was left or a search was tried; the search is blocked either way.
     */
    error?: string
    /**
     * Why the field does not fit the program's metadata. The field is left
     * out of the search; render this message in its place.
     */
    metadataError?: string
}

/**
 * The text to show for a metadata error: the full message in development, a
 * short one in production, where the full message is logged instead.
 */
export const useMetadataErrorMessage = (
    error: MetadataError | undefined
): string | undefined => {
    const { state, actions } = useFinderContext()
    const full =
        error && state.model
            ? describeMetadataError(state.model, error)
            : undefined
    const production = isProduction()
    useEffect(() => {
        if (full && production) {
            actions.logMetadataError(full)
        }
    }, [full, production, actions])
    if (!full) {
        return undefined
    }
    return production ? i18n.t("This search isn't set up correctly") : full
}

/** Internal: a field registered in the current form, with its attribute. */
export const useComposedField = (
    id: string,
    match: FormField['match']
): FinderFieldState & { found?: FinderAttribute } => {
    const { state } = useFinderContext()
    const { form, register, submitted, verdict } = useFinderFormContext()
    const key = useId()

    useLayoutEffect(
        () => register(key, { attribute: id, match }),
        [register, key, id, match]
    )

    const metadataError = verdict?.metadataErrors.find(
        (error) => error.kind !== 'form-cannot-search' && error.attribute === id
    )
    const found = state.model ? attributeOf(state.model, id) : undefined
    const attribute = useMemo(
        () =>
            found &&
            Object.freeze({
                kind: found.kind,
                label: found.label,
                valueType: found.valueType,
                unique: found.unique,
                ...(found.options && { options: found.options }),
            }),
        [found]
    )
    const field = useFinderFieldApi(
        form,
        id,
        metadataError ? undefined : found,
        match
    )
    const shown = submitted || field.state.meta.isBlurred
    const [error] = field.state.meta.errors
    return {
        found,
        field,
        attribute,
        error: shown ? error : undefined,
        metadataError: useMetadataErrorMessage(metadataError),
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
    /** Whether the values make a search now. */
    canSearch: boolean
    /** Details still needed to reach the program's minimum. */
    missing: number
    reason: FormVerdict['reason']
    /** The label of the ID that searches alone. */
    searchingBy?: string
    /** Searches when it can; with field errors, shows them all instead. */
    submit: () => void
}

/** The current form's search: whether it can run, and running it. */
export const useFinderSearch = (): FinderSearchState => {
    const { state } = useFinderContext()
    const { form, verdict } = useFinderFormContext()
    const search = state.status === 'ready' ? verdict?.search : undefined
    // Through TanStack, so a search with field errors shows them instead.
    const submit = useCallback(() => {
        void form.handleSubmit()
    }, [form])
    const searchingBy =
        verdict?.searchingBy && state.model
            ? attributeOf(state.model, verdict.searchingBy)?.label
            : undefined
    return {
        canSearch: search !== undefined,
        missing: verdict?.missing ?? 0,
        reason:
            verdict?.reason ??
            (state.status === 'error' ? 'metadata-error' : 'empty'),
        searchingBy,
        submit,
    }
}

interface FinderProgramAttribute {
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
    // Also after a failed or empty later page, so the user can go back.
    const hasPrevious = page > 1 && status !== 'searching'
    // No-ops without a page to go to, as the disabled buttons are.
    const next = useCallback(() => {
        if (hasNext) {
            setPage(page + 1)
        }
    }, [setPage, page, hasNext])
    const previous = useCallback(() => {
        if (hasPrevious) {
            setPage(page - 1)
        }
    }, [setPage, page, hasPrevious])
    return {
        status,
        people,
        page,
        hasNext,
        hasPrevious,
        refreshing,
        next,
        previous,
        select,
    }
}

/**
 * The TanStack form of the `FinderForm` around it: its values, field meta,
 * `Subscribe` and `reset`. A field counts toward the search only through
 * `useFinderField`, `useFinderRangeField` or the field parts.
 */
export const useFinderForm = (): FinderFormApi => useFinderFormContext().form

/** The person of the current `FinderList` item, for custom row content. */
export const useFinderPerson = (): FinderPerson => {
    const person = useContext(FinderPersonContext)
    if (!person) {
        throw new Error('useFinderPerson must be used inside FinderList')
    }
    return person
}
