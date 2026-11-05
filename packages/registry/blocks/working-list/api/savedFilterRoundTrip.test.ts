import type { AppliedFilter } from '../domain/model'
import { resolveWorkingListCapabilities } from './capabilities'
import { buildProgramFieldCatalog, fieldsForConfiguration } from './metadata'
import {
    buildSavedListPayload,
    normalizeSavedWorkingListResource,
    repairSavedWorkingList,
} from './savedLists'
import {
    ProgramStageWorkingListSchema,
    TrackedEntityInstanceFilterSchema,
    type SavedValueFilter,
} from './schemas'

const programId = 'Program0001'
const stageId = 'Stage000001'
const attributeId = 'Attribute01'
const dataElementId = 'DataItem001'
const metadata = buildProgramFieldCatalog({
    program: {
        id: programId,
        displayName: 'Program',
        programType: 'WITH_REGISTRATION',
        programTrackedEntityAttributes: [
            {
                displayInList: true,
                trackedEntityAttribute: {
                    id: attributeId,
                    displayName: 'Attribute',
                    valueType: 'DATE',
                },
            },
        ],
        programStages: [
            {
                id: stageId,
                displayName: 'Stage',
                programStageDataElements: [
                    {
                        displayInReports: true,
                        dataElement: {
                            id: dataElementId,
                            displayName: 'Data element',
                            valueType: 'DATE',
                        },
                    },
                ],
            },
        ],
    },
    capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
    hasSelectedOrgUnit: true,
})

const absolute = {
    type: 'ABSOLUTE' as const,
    startDate: '2026-01-01',
    futureDate: { nested: ['date'] },
}
const cases = [
    {
        type: 'trackedEntityInstanceFilters' as const,
        criteriaKey: 'entityQueryCriteria',
        filtersKey: 'attributeValueFilters',
        referenceKey: 'attribute',
        id: attributeId,
    },
    {
        type: 'programStageWorkingLists' as const,
        criteriaKey: 'programStageQueryCriteria',
        filtersKey: 'dataFilters',
        referenceKey: 'dataItem',
        id: dataElementId,
    },
]

describe.each(cases)(
    '$type extension replacement',
    ({ type, criteriaKey, filtersKey, referenceKey, id }) => {
        const resource = (filters: SavedValueFilter[]) => {
            const common = {
                id: 'SavedList01',
                displayName: 'Saved',
                program: { id: programId },
                publicAccess: 'r-------',
                userAccesses: [
                    {
                        id: 'User0000001',
                        access: 'rw------',
                        futureAccess: { retained: true },
                    },
                ],
                [criteriaKey]: {
                    displayColumnOrder: [id],
                    order: 'createdAt:desc',
                    futureCriteria: { nested: [1] },
                    [filtersKey]: filters,
                },
            }
            return type === 'programStageWorkingLists'
                ? { ...common, programStage: { id: stageId } }
                : common
        }
        const normalize = (raw: ReturnType<typeof resource>) =>
            normalizeSavedWorkingListResource({
                resource:
                    type === 'trackedEntityInstanceFilters'
                        ? TrackedEntityInstanceFilterSchema.parse(raw)
                        : ProgramStageWorkingListSchema.parse(raw),
                type,
                programId,
                metadata,
            })
        const savedFilter = {
            [referenceKey]: id,
            dateFilter: absolute,
            futureFilter: { nested: ['filter'] },
        }

        it('round-trips nested extensions and sharing while replacing known operators without resurrection', () => {
            const list = normalize(resource([savedFilter]))
            if (list.compatibility !== 'compatible')
                throw new Error(JSON.stringify(list.issues))
            const build = (filters: AppliedFilter[]) =>
                buildSavedListPayload({
                    name: list.name,
                    configuration: { ...list.configuration, filters },
                    fields: fieldsForConfiguration(
                        metadata,
                        list.configuration
                    ),
                    capabilities: metadata.capabilities,
                    existingResource: list.raw,
                    sharing: list.sharing,
                })
            expect(build(list.configuration.filters).data).toMatchObject({
                userAccesses: [
                    {
                        id: 'User0000001',
                        access: 'rw------',
                        futureAccess: { retained: true },
                    },
                ],
                [criteriaKey]: {
                    futureCriteria: { nested: [1] },
                    [filtersKey]: [savedFilter],
                },
            })
            const relative = build([
                {
                    ...list.configuration.filters[0],
                    value: {
                        kind: 'dateRange',
                        mode: 'relative',
                        period: 'THIS_MONTH',
                    },
                },
            ])
            expect(relative.data).toMatchObject({
                [criteriaKey]: {
                    [filtersKey]: [
                        {
                            [referenceKey]: id,
                            dateFilter: {
                                type: 'RELATIVE',
                                period: 'THIS_MONTH',
                                futureDate: absolute.futureDate,
                            },
                            futureFilter: savedFilter.futureFilter,
                        },
                    ],
                },
            })
            expect(JSON.stringify(relative.data)).not.toContain('startDate')
            const empty = build([
                {
                    ...list.configuration.filters[0],
                    operator: 'empty',
                    value: { kind: 'empty', isEmpty: true },
                },
            ])
            expect(empty.data).toMatchObject({
                [criteriaKey]: {
                    [filtersKey]: [
                        {
                            [referenceKey]: id,
                            null: true,
                            futureFilter: savedFilter.futureFilter,
                        },
                    ],
                },
            })
            expect(JSON.stringify(empty.data)).not.toContain('dateFilter')
            expect(JSON.stringify(build([]).data)).not.toContain('futureFilter')
        })

        it('repairs multiple raw addresses against original indexes without mutating the source', () => {
            const list = normalize(
                resource([
                    { ...savedFilter, [referenceKey]: 'Missing0001' },
                    savedFilter,
                    { ...savedFilter, [referenceKey]: 'Missing0002' },
                ])
            )
            if (list.compatibility !== 'incompatible')
                throw new Error('Expected stale raw reference')
            const issues = [
                list.issues[0],
                {
                    ...list.issues[0],
                    referenceId: 'Missing0002',
                    path: `${filtersKey}.2.${referenceKey}`,
                },
            ]
            const repaired = repairSavedWorkingList({
                list: { ...list, issues },
                programId,
                metadata,
                decisions: issues.map(({ path }) => ({
                    path,
                    action: 'remove',
                })),
            })
            expect(repaired).toMatchObject({
                status: 'repaired',
                payload: {
                    data: { [criteriaKey]: { [filtersKey]: [savedFilter] } },
                },
            })
            expect(list.raw).toMatchObject({
                [criteriaKey]: {
                    [filtersKey]: [
                        { [referenceKey]: 'Missing0001' },
                        savedFilter,
                        { [referenceKey]: 'Missing0002' },
                    ],
                },
            })
        })

        it('raw replacement preserves filter extensions but replaces the nested date object', () => {
            const list = normalize(
                resource([{ ...savedFilter, [referenceKey]: 'Missing0001' }])
            )
            if (list.compatibility !== 'incompatible')
                throw new Error('Expected stale raw reference')
            expect(list.candidateConfiguration).toBeUndefined()
            const field = metadata.fields.get(id)
            if (!field) throw new Error('Expected replacement field')
            const repaired = repairSavedWorkingList({
                list,
                programId,
                metadata,
                decisions: [
                    {
                        path: `${filtersKey}.0.${referenceKey}`,
                        action: 'replaceFilter',
                        filter: {
                            field,
                            operator: 'range',
                            value: {
                                kind: 'dateRange',
                                mode: 'relative',
                                period: 'THIS_MONTH',
                            },
                        },
                    },
                ],
            })
            expect(repaired).toMatchObject({
                status: 'repaired',
                payload: {
                    data: {
                        [criteriaKey]: {
                            [filtersKey]: [
                                {
                                    [referenceKey]: id,
                                    dateFilter: {
                                        type: 'RELATIVE',
                                        period: 'THIS_MONTH',
                                    },
                                    futureFilter: savedFilter.futureFilter,
                                },
                            ],
                        },
                    },
                },
            })
            expect(JSON.stringify(repaired)).not.toContain('futureDate')
            expect(list.raw).toMatchObject({
                [criteriaKey]: {
                    [filtersKey]: [
                        { [referenceKey]: 'Missing0001', dateFilter: absolute },
                    ],
                },
            })
        })
    }
)
