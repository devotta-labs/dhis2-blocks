import type { ProgramModel, SearchFilter, ValidatedSearch } from './types'

export const PAGE_SIZE = 10

const FIELDS =
    'trackedEntity,trackedEntityType,orgUnit,programOwners[orgUnit,program],attributes[attribute,value]'

/** DHIS2 filter escaping: `/` first, so the added slashes stay single. */
const escapeFilterValue = (value: string) =>
    value.replaceAll('/', '//').replaceAll(':', '/:').replaceAll(',', '/,')

export const serializeFilter = ({
    attribute,
    conditions,
}: SearchFilter): string =>
    [
        attribute,
        ...conditions.flatMap(({ op, value }) => [
            op,
            escapeFilterValue(value),
        ]),
    ].join(':')

/** The query parameters of one page of a search. */
export const toSearchParams = (
    model: ProgramModel,
    search: ValidatedSearch,
    page: number
) => ({
    program: model.program,
    filter: search.filters.map(serializeFilter),
    orgUnitMode: 'ACCESSIBLE',
    page,
    pageSize: PAGE_SIZE,
    totalPages: true,
    fields: FIELDS,
})
