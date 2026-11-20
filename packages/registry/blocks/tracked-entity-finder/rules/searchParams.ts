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

/** Takes only a sealed search, so an unchecked one cannot be sent. */
export const toSearchParams = (
    model: ProgramModel,
    search: ValidatedSearch,
    page: number,
    orgUnit?: string
) => ({
    program: model.program,
    filter: search.filters.map(serializeFilter),
    ...(orgUnit === undefined
        ? { orgUnitMode: 'ACCESSIBLE' }
        : { orgUnitMode: 'SELECTED', orgUnits: orgUnit }),
    page,
    pageSize: PAGE_SIZE,
    totalPages: true,
    fields: FIELDS,
})
