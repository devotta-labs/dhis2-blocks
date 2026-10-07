import { resolveWorkingListCapabilities } from '../api/capabilities'
import type { ProgramFieldCatalog } from '../api/metadata'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import type { WorkingListPage } from '../query/fetchers'
import {
    canCommitMutationBaseline,
    isCurrentSelection,
    resolvePublicConfiguration,
    resolveSelectedSavedListId,
    shouldBeginControlledSelection,
    toPublicConfiguration,
} from './configuration'
import { toDisplayRows, toResultTargets, visibleRowsAsCsv } from './results'

const textField = {
    id: 'Attribute01',
    displayName: 'Name',
    source: 'trackedEntityAttribute' as const,
    scope: 'trackedEntity' as const,
    valueType: 'TEXT' as const,
    filterable: true,
}

const metadata: ProgramFieldCatalog = {
    fields: new Map([[textField.id, textField]]),
    fieldsByProgramStage: new Map(),
    capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
    defaultTrackedEntityColumns: [textField.id],
    defaultEventColumnsByStage: new Map(),
    readableProgramStageIds: new Set(),
}

describe('provider public configuration façade', () => {
    it('keeps metadata and program context out of public serializable state', () => {
        const internal: InternalConfiguration = {
            mode: 'trackedEntity',
            programId: 'Program0001',
            filters: [
                {
                    field: textField,
                    operator: 'like',
                    value: { kind: 'text', value: 'Ada' },
                },
            ],
            columns: [textField.id],
            sort: { fieldId: textField.id, direction: 'asc' },
        }

        const publicConfiguration = toPublicConfiguration(internal)

        expect(publicConfiguration).toEqual({
            mode: 'trackedEntity',
            filters: [
                {
                    fieldId: textField.id,
                    operator: 'like',
                    value: { kind: 'text', value: 'Ada' },
                },
            ],
            columns: [textField.id],
            sort: { fieldId: textField.id, direction: 'asc' },
        })
        expect(publicConfiguration).not.toHaveProperty('programId')

        const resolved = resolvePublicConfiguration({
            configuration: publicConfiguration,
            programId: 'Program0001',
            metadata,
        })

        expect(resolved.isOk()).toBe(true)

        if (resolved.isOk()) {
            expect(resolved.value.programId).toBe('Program0001')
            expect(resolved.value.filters[0].field).toEqual(textField)
        }
    })
})

describe('provider results normalization', () => {
    it('uses metadata labels verbatim and translates generic CSV headers', () => {
        const fields = new Map([
            [
                'enrolledAt',
                {
                    ...textField,
                    id: 'enrolledAt',
                    displayName: 'Start of treatment date',
                    displayNameIsMetadata: true as const,
                    source: 'system' as const,
                },
            ],
            [
                'createdAt',
                {
                    ...textField,
                    id: 'createdAt',
                    displayName: 'Registration date',
                    source: 'system' as const,
                },
            ],
        ])

        expect(
            visibleRowsAsCsv({
                rows: [],
                columns: ['enrolledAt', 'createdAt'],
                fields,
                formattingContext: {},
                translate: (message) => `translated:${message}`,
            })
        ).toBe('"Start of treatment date","translated:Registration date"')
    })

    it('builds ID-only event targets with provider and tracker context', () => {
        const page: WorkingListPage = {
            mode: 'event',
            page: 1,
            pageSize: 15,
            hasNextPage: false,
            records: [
                {
                    event: {
                        event: {
                            event: 'Event000001',
                            status: 'ACTIVE',
                            program: 'Program0001',
                            programStage: 'Stage000001',
                            enrollment: 'Enroll00001',
                            trackedEntity: 'Entity00001',
                            orgUnit: 'OrgUnit0001',
                            dataValues: [],
                        },
                        values: {},
                        issues: [],
                    },
                },
            ],
        }

        expect(toDisplayRows(page)[0]).toMatchObject({
            id: 'Event000001',
            enrollmentId: 'Enroll00001',
        })
        expect(
            toResultTargets({
                pageData: page,
                programId: 'Program0001',
                configuration: {
                    mode: 'event',
                    programStageId: 'Stage000001',
                    filters: [],
                    columns: [textField.id],
                    sort: { fieldId: textField.id, direction: 'asc' },
                },
            }).get('Event000001')
        ).toEqual({
            mode: 'event',
            programId: 'Program0001',
            programStageId: 'Stage000001',
            eventId: 'Event000001',
            enrollmentId: 'Enroll00001',
            trackedEntityId: 'Entity00001',
        })
    })
})

describe('provider selection and mutation completion guards', () => {
    const configuration = {
        mode: 'trackedEntity' as const,
        filters: [],
        columns: [textField.id],
        sort: { fieldId: textField.id, direction: 'asc' as const },
    }

    it('starts a hard transition for the initial controlled selection', () => {
        expect(shouldBeginControlledSelection(undefined, 'SavedList01')).toBe(
            true
        )
        expect(
            shouldBeginControlledSelection('SavedList01', 'SavedList01')
        ).toBe(false)
    })

    it('resolves null and blank selections to the generated default ID', () => {
        expect(resolveSelectedSavedListId(null, 'Program0001-default')).toBe(
            'Program0001-default'
        )
        expect(resolveSelectedSavedListId('', 'Program0001-default')).toBe(
            'Program0001-default'
        )
        expect(resolveSelectedSavedListId('   ', 'Program0001-default')).toBe(
            'Program0001-default'
        )
        expect(resolveSelectedSavedListId('SavedList01', 'ignored')).toBe(
            'SavedList01'
        )
    })

    it('does not commit an update baseline after selection or configuration changed', () => {
        expect(
            canCommitMutationBaseline({
                currentSelectedId: 'SavedList01',
                currentConfiguration: configuration,
                submittedSelectedId: 'SavedList01',
                submittedConfiguration: configuration,
            })
        ).toBe(true)
        expect(
            canCommitMutationBaseline({
                currentSelectedId: 'SavedList02',
                currentConfiguration: configuration,
                submittedSelectedId: 'SavedList01',
                submittedConfiguration: configuration,
            })
        ).toBe(false)
        expect(
            canCommitMutationBaseline({
                currentSelectedId: 'SavedList01',
                currentConfiguration: {
                    ...configuration,
                    columns: [],
                },
                submittedSelectedId: 'SavedList01',
                submittedConfiguration: configuration,
            })
        ).toBe(false)
    })

    it('rejects delete or repair completion after selection changed', () => {
        expect(isCurrentSelection('SavedList01', 'SavedList01')).toBe(true)
        expect(isCurrentSelection('SavedList02', 'SavedList01')).toBe(false)
    })
})
