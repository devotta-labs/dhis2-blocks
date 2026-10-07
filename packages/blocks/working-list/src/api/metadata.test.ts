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
import { normalizeSavedWorkingListResource } from './savedListNormalization'

const program: TrackerProgram = {
    id: 'Program0001',
    displayName: 'Child programme',
    programType: 'WITH_REGISTRATION',
    displayEnrollmentDateLabel: 'Start of treatment date',
    displayIncidentDate: false,
    displayIncidentDateLabel: 'Date of diagnosis',
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
            displayExecutionDateLabel: 'TB visit date',
            displayDueDateLabel: 'TB visit due date',
            hideDueDate: false,
            enableUserAssignment: true,
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
        const query = vi
            .fn()
            .mockResolvedValueOnce({
                workingListResource: { programs: [] },
            })
            .mockResolvedValueOnce({ workingListResource: program })
        const engine: DataEngineLike = {
            // SAFETY: The mock returns the same query envelopes as DataEngineLike in call order.
            query: query as DataEngineLike['query'],
            mutate: vi.fn().mockResolvedValue(undefined),
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
        expect(
            query.mock.calls[0][0].workingListResource.params?.fields
        ).toContain('style[color,icon]')
        expect(
            query.mock.calls[0][0].workingListResource.params?.fields
        ).toContain('organisationUnits[id,displayName,path]')
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
        expect(getProgramMetadataFields(41)).toContain(
            'displayEnrollmentDateLabel'
        )
        expect(getProgramMetadataFields(41)).toContain(
            'displayExecutionDateLabel'
        )
    })

    it('builds fields, default columns, and program-stage membership once', () => {
        const catalog = buildProgramFieldCatalog({
            program,
            capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
            hasSelectedOrgUnit: true,
        })

        expect(catalog.defaultTrackedEntityColumns).toEqual(['Attribute01'])
        expect(catalog.fields.get('enrolledAt')).toMatchObject({
            displayName: 'Start of treatment date',
            displayNameIsMetadata: true,
        })
        expect(catalog.fields.get('enrollmentOccurredAt')).toMatchObject({
            displayName: 'Date of diagnosis',
            displayNameIsMetadata: true,
            filterable: false,
        })
        expect(catalog.fields.get('assignedUser')?.filterable).toBe(true)
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
        expect(
            catalog.fieldsByProgramStage
                .get('ProgramStg1')
                ?.get('eventOccurredAt')
        ).toMatchObject({
            displayName: 'TB visit date',
            displayNameIsMetadata: true,
        })
        expect(
            catalog.fieldsByProgramStage
                .get('ProgramStg1')
                ?.get('eventScheduledAt')
        ).toMatchObject({
            displayName: 'TB visit due date',
            displayNameIsMetadata: true,
            filterable: true,
            columnable: true,
        })
        expect(
            catalog.fieldsByProgramStage
                .get('ProgramStg1')
                ?.get('eventAssignedUser')
        ).toMatchObject({ filterable: true, columnable: true })
        expect(
            catalog.fieldsByProgramStage
                .get('ProgramStg2')
                ?.get('eventOccurredAt')
        ).toMatchObject({ displayName: 'Report date' })
        expect(
            catalog.fieldsByProgramStage
                .get('ProgramStg2')
                ?.get('eventOccurredAt')?.displayNameIsMetadata
        ).toBeUndefined()
        expect(
            catalog.fieldsByProgramStage
                .get('ProgramStg2')
                ?.get('eventScheduledAt')
        ).toMatchObject({ filterable: false, columnable: false })
        expect(
            catalog.fieldsByProgramStage
                .get('ProgramStg2')
                ?.get('eventAssignedUser')
        ).toMatchObject({ filterable: false, columnable: false })
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

    it('keeps generic system labels as localizable fallbacks', () => {
        const catalog = buildProgramFieldCatalog({
            program: {
                ...program,
                displayEnrollmentDateLabel: null,
                displayIncidentDate: true,
                displayIncidentDateLabel: null,
                programStages: program.programStages.map((stage) => ({
                    ...stage,
                    displayExecutionDateLabel: null,
                    displayDueDateLabel: null,
                })),
            },
            capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
            hasSelectedOrgUnit: true,
        })

        expect(catalog.fields.get('enrolledAt')).toMatchObject({
            displayName: 'Enrollment date',
            filterable: true,
        })
        expect(
            catalog.fields.get('enrolledAt')?.displayNameIsMetadata
        ).toBeUndefined()
        expect(catalog.fields.get('enrollmentOccurredAt')).toMatchObject({
            displayName: 'Incident date',
            filterable: true,
        })
        expect(
            catalog.fieldsByProgramStage
                .get('ProgramStg1')
                ?.get('eventOccurredAt')
        ).toMatchObject({ displayName: 'Report date' })
        expect(
            catalog.fieldsByProgramStage
                .get('ProgramStg1')
                ?.get('eventScheduledAt')
        ).toMatchObject({ displayName: 'Scheduled date' })
    })

    it('normalizes saved stage filters with the stage metadata label', () => {
        const catalog = buildProgramFieldCatalog({
            program,
            capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
            hasSelectedOrgUnit: true,
        })
        const normalized = normalizeSavedWorkingListResource({
            resource: {
                id: 'SavedList01',
                displayName: 'TB visits',
                program: { id: program.id },
                programStage: { id: 'ProgramStg1' },
                programStageQueryCriteria: {
                    displayColumnOrder: ['occurredAt'],
                    eventOccurredAt: {
                        type: 'ABSOLUTE',
                        startDate: '2026-08-01',
                    },
                },
            },
            type: 'programStageWorkingLists',
            programId: program.id,
            metadata: catalog,
        })

        expect(normalized.compatibility).toBe('compatible')
        if (normalized.compatibility === 'compatible') {
            expect(normalized.configuration.filters[0]?.field).toMatchObject({
                id: 'eventOccurredAt',
                displayName: 'TB visit date',
                displayNameIsMetadata: true,
            })
            expect(normalized.configuration.columns).toContain(
                'eventOccurredAt'
            )
        }
    })
})
