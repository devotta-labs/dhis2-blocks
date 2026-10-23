import type {
    DataEngineLike,
    FieldValue,
    FinderEmptyProps,
    FinderErrorProps,
    FinderFieldProps,
    FinderFormProps,
    FinderHintProps,
    FinderItemProps,
    FinderListProps,
    FinderPaginationProps,
    FinderPerson,
    FinderProviderProps,
    FinderRangeFieldProps,
    FinderResultsProps,
    FinderSearchingProps,
    FinderSubmitProps,
    FinderTooManyProps,
    FinderValueProps,
    TrackedEntityFinderClient,
} from '..'
import {
    FinderEmpty,
    FinderError,
    FinderField,
    FinderForm,
    FinderHint,
    FinderItem,
    FinderList,
    FinderPagination,
    FinderProvider,
    FinderRangeField,
    FinderResults,
    FinderSearching,
    FinderSubmit,
    FinderTooMany,
    FinderValue,
    createTrackedEntityFinderClient,
    useFinderField,
    useFinderPerson,
    useFinderProgram,
    useFinderRangeField,
    useFinderResults,
    useFinderSearch,
} from '..'
import * as publicApi from '..'
import type { ValidatedSearch } from '../rules/types'

export type SupportedFinderTypes = [
    DataEngineLike,
    FieldValue,
    FinderEmptyProps,
    FinderErrorProps,
    FinderFieldProps,
    FinderFormProps,
    FinderHintProps,
    FinderItemProps,
    FinderListProps,
    FinderPaginationProps,
    FinderPerson,
    FinderProviderProps,
    FinderRangeFieldProps,
    FinderResultsProps,
    FinderSearchingProps,
    FinderSubmitProps,
    FinderTooManyProps,
    FinderValueProps,
    TrackedEntityFinderClient,
]

export const supportedFinderExports = [
    FinderProvider,
    FinderForm,
    FinderField,
    FinderRangeField,
    FinderHint,
    FinderSubmit,
    FinderResults,
    FinderSearching,
    FinderEmpty,
    FinderTooMany,
    FinderError,
    FinderList,
    FinderItem,
    FinderValue,
    FinderPagination,
    useFinderField,
    useFinderRangeField,
    useFinderSearch,
    useFinderResults,
    useFinderPerson,
    useFinderProgram,
    createTrackedEntityFinderClient,
] as const

// The rules cannot be loosened through props: each extra prop is rejected.
const providerProps = { program: 'program-a', onSelect: () => undefined }
export const providers: unknown[] = [
    // @ts-expect-error the minimum attributes come from the program
    FinderProvider({ ...providerProps, minAttributes: 1 }),
    // @ts-expect-error the result cap is not configurable
    FinderProvider({ ...providerProps, maxResults: 100 }),
    // @ts-expect-error the program decides how org units are used
    FinderProvider({ ...providerProps, orgUnitMode: 'ACCESSIBLE' }),
    // @ts-expect-error extra filters are not accepted
    FinderProvider({ ...providerProps, filters: [] }),
    // @ts-expect-error the program decides the tracked entity type
    FinderProvider({ ...providerProps, trackedEntityType: 'person' }),
    // @ts-expect-error the program decides the scope
    FinderProvider({ ...providerProps, scope: 'all' }),
]

export const fields: unknown[] = [
    // @ts-expect-error a field is searched by exact value
    FinderField({ attribute: 'uid', range: true }),
    // @ts-expect-error a field is searched by exact value
    FinderField({ attribute: 'uid', operator: 'like' }),
    // @ts-expect-error uniqueness comes from the program
    FinderField({ attribute: 'uid', unique: true }),
    // @ts-expect-error searchability comes from the program
    FinderField({ attribute: 'uid', searchable: true }),
]

export const hookCall = (): void => {
    // @ts-expect-error a field hook takes only the attribute uid
    useFinderField('uid', { range: true })
}

// @ts-expect-error list children are plain elements, not a render function
export const list = FinderList({ children: () => null })

// A search is only made by the rules, never from a plain object.
// @ts-expect-error the brand cannot be forged
export const forged: ValidatedSearch = { filters: [] }

export const client = createTrackedEntityFinderClient({
    query: async () => ({}),
})
// @ts-expect-error the client is opaque and has no query method
export const noQuery = client.query

// What the hooks return is read-only.
export const programState = (): void => {
    const program = useFinderProgram()
    // @ts-expect-error the program state is readonly
    program.status = 'ready'
    // @ts-expect-error the attribute list is readonly
    program.searchableAttributes.push({
        id: 'a',
        label: 'A',
        valueType: 'TEXT',
        unique: false,
    })
}

export const fieldState = (): void => {
    const state = useFinderField('uid')
    if (state.attribute) {
        // @ts-expect-error the attribute is readonly
        state.attribute.label = 'Other'
    }
}

export const resultsState = (): void => {
    const results = useFinderResults()
    // @ts-expect-error the people list is readonly
    results.people.push(results.people[0])
}

// The internal context is not exported.
// @ts-expect-error not part of the public surface
export const noContext = publicApi.FinderContext
