import { resolveWorkingListCapabilities } from './capabilities'
import { createWorkingListClient, type DataEngineLike } from './client'
import {
    PROGRAM_SUMMARY_FIELDS,
    buildProgramFieldCatalog,
    fetchTrackerProgram,
    fetchTrackerPrograms,
    getProgramMetadataFields,
} from './metadata'
import type { TrackerProgram } from './schemas'

const program: TrackerProgram = {
    id: 'Program0001',
    displayName: 'Child programme',
    programType: 'WITH_REGISTRATION',
    programTrackedEntityAttributes: [
        {
            displayInList: true,
            searchable: true,
            mandatory: true,
            trackedEntityAttribute: {
                id: 'Attribute01',
                displayName: 'First name',
                valueType: 'TEXT',
            },
        },
        {
            displayInList: false,
            trackedEntityAttribute: {
                id: 'FileField01',
                displayName: 'Attachment',
                valueType: 'FILE_RESOURCE',
            },
        },
    ],
    programStages: [
        {
            id: 'ProgramStg1',
            displayName: 'Birth',
            hideDueDate: false,
            programStageDataElements: [
                {
                    displayInReports: true,
                    compulsory: true,
                    dataElement: {
                        id: 'DataElement1',
                        displayName: 'Weight',
                        valueType: 'NUMBER',
                    },
                },
            ],
        },
        {
            id: 'ProgramStg2',
            displayName: 'Postnatal',
            programStageDataElements: [
                {
                    displayInReports: false,
                    dataElement: {
                        id: 'DataElement1',
                        displayName: 'Weight',
                        valueType: 'NUMBER',
                    },
                },
            ],
        },
    ],
}

describe('version-aware Tracker metadata catalog', () => {
    it('loads lightweight program summaries before one selected program', async () => {
        const query: jest.MockedFunction<DataEngineLike['query']> = jest
            .fn()
            .mockResolvedValueOnce({
                workingListResource: { programs: [] },
            })
            .mockResolvedValueOnce({ workingListResource: program })
        const engine: DataEngineLike = {
            query,
            mutate: jest.fn().mockResolvedValue(undefined),
        }
        const client = createWorkingListClient(engine)

        await fetchTrackerPrograms(client)
        await fetchTrackerProgram(client, {
            apiVersion: 43,
            programId: program.id,
        })

        expect(query.mock.calls[0][0]).toEqual({
            workingListResource: {
                resource: 'programs',
                params: {
                    fields: PROGRAM_SUMMARY_FIELDS,
                    filter: 'programType:eq:WITH_REGISTRATION',
                    paging: false,
                },
            },
        })
        expect(
            query.mock.calls[0][0].workingListResource.params?.fields
        ).not.toContain('programStages')
        expect(query.mock.calls[1][0]).toMatchObject({
            workingListResource: {
                id: program.id,
                resource: 'programs',
            },
        })
        expect(
            query.mock.calls[1][0].workingListResource.params?.fields
        ).toContain('programStages[')
    })

    it('does not request newer search fields from v41/v42', () => {
        for (const apiVersion of [41, 42]) {
            expect(getProgramMetadataFields(apiVersion)).not.toContain(
                'preferredSearchOperator'
            )
            expect(getProgramMetadataFields(apiVersion)).not.toContain(
                'minCharactersToSearch'
            )
        }
        expect(getProgramMetadataFields(43)).toContain(
            'preferredSearchOperator'
        )
    })

    it('builds fields, default columns, and program-stage membership once', () => {
        const catalog = buildProgramFieldCatalog({
            program,
            capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
            hasSelectedOrgUnit: true,
        })

        expect(catalog.defaultTrackedEntityColumns).toEqual(['Attribute01'])
        expect(catalog.fields.get('createdAt')?.valueType).toBe('DATETIME')
        expect(catalog.fields.get('DataElement1')?.programStageIds).toEqual([
            'ProgramStg1',
            'ProgramStg2',
        ])
        expect(catalog.fields.get('Attribute01')?.required).toBe(true)
        expect(catalog.fields.get('FileField01')?.required).toBeUndefined()
        expect(catalog.fields.get('DataElement1')?.requiredInStageIds).toEqual([
            'ProgramStg1',
        ])
        expect(catalog.defaultEventColumnsByStage.get('ProgramStg1')).toEqual(
            expect.arrayContaining([
                'Attribute01',
                'eventStatus',
                'eventOccurredAt',
                'eventScheduledAt',
                'eventOrgUnit',
                'DataElement1',
            ])
        )
    })

    it('keeps unsupported values as columns while hiding unreliable filters', () => {
        const v41 = buildProgramFieldCatalog({
            program,
            capabilities: resolveWorkingListCapabilities({ apiVersion: 41 }),
            hasSelectedOrgUnit: true,
        })
        const v42 = buildProgramFieldCatalog({
            program,
            capabilities: resolveWorkingListCapabilities({ apiVersion: 42 }),
            hasSelectedOrgUnit: true,
        })

        expect(v41.fields.has('FileField01')).toBe(true)
        expect(v41.fields.get('FileField01')?.filterable).toBe(false)
        expect(v42.fields.get('FileField01')?.filterable).toBe(true)
    })
})
