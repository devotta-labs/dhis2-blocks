import { useContext, useId, useLayoutEffect, useMemo } from 'react'
import { useSearchPages } from './api/queries'
import type { FinderPerson } from './api/search'
import { metadataErrorText } from './form/errorText'
import {
    useFinderFieldApi,
    type FinderFieldApi,
    type FinderFormApi,
} from './form/finderFormApi'
import {
    FinderPersonContext,
    useFinderContext,
    useFinderFormContext,
} from './provider/context'
import { useFinderModel } from './provider/useFinderModel'
import { describeMetadataError } from './rules/describeMetadataError'
import { attributeOf, searchableAttributes } from './rules/programModel'
import type { FieldKind, FormField, FormVerdict } from './rules/types'

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
 * Internal: adds a field to the form around it, and reads its attribute,
 * its TanStack field and what is wrong with it.
 */
export const useComposedField = (id: string, match: FormField['match']) => {
    const { model, isPending, isError } = useFinderModel()
    const { form, register, submitted, verdict } = useFinderFormContext()
    const key = useId()

    useLayoutEffect(
        () => register(key, { attribute: id, match }),
        [register, key, id, match]
    )

    const metadataError = verdict?.metadataErrors.find(
        (error) => error.kind !== 'form-cannot-search' && error.attribute === id
    )
    const attribute = model ? attributeOf(model, id) : undefined
    // A field with a metadata error is left out of the search: no validation.
    const field = useFinderFieldApi(
        form,
        id,
        metadataError ? undefined : attribute,
        match
    )
    const [error] = field.state.meta.errors
    return {
        field,
        attribute,
        error: submitted || field.state.meta.isBlurred ? error : undefined,
        /** The full setup message, for whoever composed the form. */
        metadataError:
            model && metadataError
                ? describeMetadataError(model, metadataError)
                : undefined,
        /** Inputs wait for the server calendar too, not only the program. */
        ready: !isPending && !isError,
    }
}

const toFieldState = ({
    field,
    attribute,
    error,
    metadataError,
}: ReturnType<typeof useComposedField>): FinderFieldState => ({
    field,
    attribute,
    error,
    metadataError: metadataError && metadataErrorText(metadataError),
})

/** A field searched by exact value. Use inside `FinderForm`. */
export const useFinderField = (attribute: string): FinderFieldState => {
    const field = useComposedField(attribute, 'exact')
    return toFieldState(field)
}

/** A From–To field for a number or date attribute. Use inside `FinderForm`. */
export const useFinderRangeField = (attribute: string): FinderFieldState => {
    const field = useComposedField(attribute, 'range')
    return toFieldState(field)
}

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
    const { model, isPending, isError } = useFinderModel()
    const { form, verdict } = useFinderFormContext()
    return {
        canSearch: !isPending && !isError && verdict?.search !== undefined,
        missing: verdict?.missing ?? 0,
        reason: verdict?.reason ?? (isError ? 'metadata-error' : 'empty'),
        searchingBy:
            model && verdict?.searchingBy
                ? attributeOf(model, verdict.searchingBy)?.label
                : undefined,
        // Through TanStack, so a search with field errors shows them instead.
        submit: () => void form.handleSubmit(),
    }
}

interface FinderProgramAttribute {
    readonly id: string
    readonly label: string
    readonly valueType: string
    readonly unique: boolean
}

export interface FinderProgramState {
    readonly status: 'loading' | 'ready' | 'error'
    readonly name?: string
    readonly searchableAttributes: ReadonlyArray<FinderProgramAttribute>
}

const NO_ATTRIBUTES: FinderProgramAttribute[] = []

/** The program's name and searchable attributes, read-only. */
export const useFinderProgram = (): FinderProgramState => {
    const { model, isPending, isError } = useFinderModel()
    const attributes = useMemo(
        () => (model ? searchableAttributes(model) : NO_ATTRIBUTES),
        [model]
    )
    const status = (): FinderProgramState['status'] => {
        if (isError) {
            return 'error'
        }
        return isPending ? 'loading' : 'ready'
    }
    return {
        status: status(),
        name: model?.name,
        searchableAttributes: attributes,
    }
}

export interface FinderResultsState {
    status: 'idle' | 'searching' | 'results' | 'empty' | 'too-many' | 'error'
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

const NO_PEOPLE: FinderPerson[] = []

/** The last submitted search's results, and paging through them. */
export const useFinderResults = (): FinderResultsState => {
    const { submission, setSubmission, onSelect } = useFinderContext()
    const { model, isError: setupFailed } = useFinderModel()
    const query = useSearchPages(model, submission?.search)
    const pages = query.data?.pages ?? []
    // A page past the loaded ones is on screen only while it loads, or
    // after it failed; otherwise the last loaded page is.
    const reachable =
        pages.length + (query.isFetchingNextPage || query.isError ? 1 : 0)
    const page = Math.max(1, Math.min(submission?.page ?? 1, reachable))
    const loaded = pages[page - 1]
    // The previous page stays on screen while the next one loads.
    const outcome = loaded ?? pages.at(-1)

    const status = ((): FinderResultsState['status'] => {
        if (setupFailed) {
            return 'error'
        }
        if (!submission) {
            return 'idle'
        }
        if (!loaded && query.isError && !query.isFetching) {
            return 'error'
        }
        if (!outcome) {
            return 'searching'
        }
        if (outcome.kind === 'too-many') {
            return 'too-many'
        }
        return outcome.people.length > 0 ? 'results' : 'empty'
    })()
    const found = status === 'results' && outcome?.kind === 'results'
    const hasNext = found && outcome.hasNext
    // Also after a failed or empty later page, so the user can go back.
    const hasPrevious = page > 1 && status !== 'searching'
    const refreshing = status !== 'searching' && query.isFetching

    return {
        status,
        people: found ? outcome.people : NO_PEOPLE,
        page,
        hasNext,
        hasPrevious,
        refreshing,
        // No-ops without a page to go to, as the disabled buttons are.
        next: () => {
            if (!submission || !hasNext || refreshing) {
                return
            }
            setSubmission({ ...submission, page: page + 1 })
            if (page === pages.length) {
                void query.fetchNextPage()
            }
        },
        previous: () => {
            if (submission && hasPrevious) {
                setSubmission({ ...submission, page: page - 1 })
            }
        },
        select: onSelect,
    }
}

/**
 * The TanStack form of the `FinderForm` around it: its values, field meta,
 * `Subscribe` and `reset`. A field counts toward the search only through
 * `useFinderField`, `useFinderRangeField` or the field parts.
 */
export const useFinderForm = (): FinderFormApi => {
    const { form } = useFinderFormContext()
    return form
}

/** The person of the current `FinderList` item, for custom row content. */
export const useFinderPerson = (): FinderPerson => {
    const person = useContext(FinderPersonContext)
    if (!person) {
        throw new Error('useFinderPerson must be used inside FinderList')
    }
    return person
}
