import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { searchQueryOptions } from './api/queries'
import type { FinderPerson } from './api/search'
import { useFinderContext, type FinderResultsStatus } from './provider/context'
import { evaluateForm } from './rules/evaluateForm'
import { attributeOf } from './rules/programModel'
import type { FormField, ProgramModel, ValidatedSearch } from './rules/types'

function planSearch(
    model: ProgramModel,
    textByAttribute: Readonly<Record<string, string>>,
    match: 'all' | 'any',
    orgUnit?: string
) {
    const ids = Object.keys(textByAttribute)
    if (!ids.length || (match === 'any' && (!orgUnit || ids.length > 3))) {
        return
    }
    const fields: FormField[] = []
    for (const attribute of ids) {
        const definition = attributeOf(model, attribute)
        if (definition?.kind !== 'text' || definition.unique) return
        fields.push({ attribute, match: 'exact' })
    }
    const values = Object.fromEntries(
        ids.map((id) => [
            id,
            { kind: 'text' as const, text: textByAttribute[id] },
        ])
    )
    const groups = match === 'all' ? [fields] : fields.map((field) => [field])
    const plan: ValidatedSearch[] = []
    for (const group of groups) {
        const { search, metadataErrors } = evaluateForm(model, group, values)
        if (
            !search ||
            metadataErrors.length ||
            search.filters.length !== group.length
        ) {
            return
        }
        plan.push(search)
    }
    return plan
}

interface FinderTextSearchState {
    status: FinderResultsStatus | 'loading'
    canSearch: boolean
    submit: () => void
    people: readonly FinderPerson[]
    select: (person: FinderPerson) => void
}

/** One input mapped to non-unique text attributes within FinderProvider. */
export function useFinderTextSearch(
    textByAttribute: Readonly<Record<string, string>>,
    match: 'all' | 'any'
): FinderTextSearchState {
    const engine = useDataEngine()
    const { baseUrl } = useConfig()
    const queryClient = useQueryClient()
    const { state, meta, actions } = useFinderContext()
    const { model } = state
    const { orgUnit } = meta
    const [submitted, setSubmitted] = useState<ValidatedSearch[]>()
    const plan =
        model && state.status === 'ready'
            ? planSearch(model, textByAttribute, match, orgUnit)
            : undefined
    const optionsFor = (model: ProgramModel, search: ValidatedSearch) => ({
        ...searchQueryOptions(engine, baseUrl, model, search, 1, orgUnit),
        retry: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    })
    const queries = useQueries({
        queries:
            model && submitted
                ? submitted.map((search) => optionsFor(model, search))
                : [],
    })
    const searching = queries.some(
        ({ isPending, isFetching }) => isPending || isFetching
    )
    const canSearch = plan !== undefined && !searching
    const controls = {
        canSearch,
        submit: () => {
            if (!model || !plan || !canSearch) return
            for (const search of plan) {
                void queryClient.prefetchQuery(optionsFor(model, search))
            }
            setSubmitted(plan)
        },
        select: actions.select,
    }
    if (state.status === 'error' || queries.some(({ isError }) => isError)) {
        return { ...controls, status: 'error', people: [] }
    }
    if (state.status === 'loading') {
        return { ...controls, status: 'loading', people: [] }
    }
    if (!submitted || searching) {
        return {
            ...controls,
            status: submitted ? 'searching' : 'idle',
            people: [],
        }
    }
    const people = new Map<string, FinderPerson>()
    for (const { data } of queries) {
        if (data?.kind !== 'results' || data.hasNext) {
            return { ...controls, status: 'too-many', people: [] }
        }
        for (const person of data.people)
            people.set(person.trackedEntity, person)
    }
    if (model?.maxResults && people.size > model.maxResults) {
        return { ...controls, status: 'too-many', people: [] }
    }
    return {
        ...controls,
        status: people.size ? 'results' : 'empty',
        people: [...people.values()],
    }
}
