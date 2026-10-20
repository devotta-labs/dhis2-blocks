import eventFixture from './__fixtures__/event.json'
import stageFixture from './__fixtures__/rmnch-stage.json'
import {
    DEFAULT_SECTION_ID,
    ProgramResponseSchema,
    SystemCalendarSchema,
    toStageMetadata,
    TrackerEventSchema,
} from './schemas'

const STAGE_ID = 'WZbXY0S00lP'

describe('toStageMetadata', () => {
    it('parses RMNCH stage metadata', () => {
        const result = toStageMetadata(
            ProgramResponseSchema.parse(stageFixture),
            STAGE_ID
        )
        expect(result.isOk()).toBe(true)
        const metadata = result.unwrap()

        expect(metadata.programId).toBe('WSGAb5XwJ3Y')
        expect(metadata.programName).toBe('WHO RMNCH Tracker')
        expect(metadata.hasCategoryCombo).toBe(false)
        expect(metadata.stage).toMatchObject({
            id: STAGE_ID,
            name: 'First antenatal care visit',
            executionDateLabel: 'Date of visit',
            blockEntryForm: true,
            featureType: 'NONE',
        })
        expect(['NONE', 'ON_COMPLETE', 'ON_UPDATE_AND_INSERT']).toContain(
            metadata.stage.validationStrategy
        )
        expect(metadata.stage.sections).toHaveLength(4)
        expect(metadata.stage.sections.map((section) => section.name)).toEqual([
            'Pre-existing conditions',
            'Current pregnancy',
            'Lab/testing',
            'Management',
        ])
        expect(metadata.dataElements.size).toBe(49)
        expect(metadata.dataElements.get('de0FEHSIoxh')).toMatchObject({
            id: 'de0FEHSIoxh',
            label: 'WHOMCH Chronic conditions',
            valueType: 'BOOLEAN',
            compulsory: false,
            allowFutureDate: false,
        })
        const sectioned = metadata.stage.sections.flatMap(
            (section) => section.dataElementIds
        )
        expect(new Set(sectioned)).toEqual(
            new Set(metadata.dataElements.keys())
        )
    })

    it('stage without sections gets an implicit section', () => {
        const [stage] = stageFixture.programStages
        const withoutSections = {
            ...stageFixture,
            programStages: [{ ...stage, programStageSections: [] }],
        }
        const metadata = toStageMetadata(
            ProgramResponseSchema.parse(withoutSections),
            STAGE_ID
        ).unwrap()

        expect(metadata.stage.sections).toHaveLength(1)
        const [section] = metadata.stage.sections
        expect(section).toMatchObject({
            id: DEFAULT_SECTION_ID,
            name: 'First antenatal care visit',
        })
        const bySortOrder = [...stage.programStageDataElements]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((entry) => entry.dataElement.id)
        expect(section?.dataElementIds).toEqual(bySortOrder)
        expect(section?.dataElementIds).toHaveLength(49)
    })

    it('rejects metadata missing the stage', () => {
        const result = toStageMetadata(
            ProgramResponseSchema.parse(stageFixture),
            'unknownStg1'
        )
        expect(result.isErr()).toBe(true)
        if (result.isErr()) {
            expect(result.error.kind).toBe('not-found')
            expect(result.error.message).toContain('unknownStg1')
        }
    })

    it('flags a program with a non-default category combo', () => {
        const metadata = toStageMetadata(
            ProgramResponseSchema.parse({
                ...stageFixture,
                categoryCombo: { id: 'abcdefghijk', isDefault: false },
            }),
            STAGE_ID
        ).unwrap()
        expect(metadata.hasCategoryCombo).toBe(true)
    })

    it('maps option sets in sort order and the render type', () => {
        const raw = ProgramResponseSchema.parse({
            ...stageFixture,
            programStages: [
                {
                    id: STAGE_ID,
                    displayName: 'Stage',
                    programStageDataElements: [
                        {
                            compulsory: true,
                            sortOrder: 1,
                            allowFutureDate: true,
                            renderType: {
                                DESKTOP: { type: 'HORIZONTAL_RADIOBUTTONS' },
                            },
                            dataElement: {
                                id: 'deOptions01',
                                displayFormName: 'Choice',
                                displayDescription: 'Pick one',
                                valueType: 'TEXT',
                                fieldMask: '999',
                                optionSetValue: true,
                                optionSet: {
                                    id: 'optionSet01',
                                    options: [
                                        {
                                            id: 'optionB0001',
                                            code: 'B',
                                            displayName: 'Bee',
                                            sortOrder: 2,
                                        },
                                        {
                                            id: 'optionA0001',
                                            code: 'A',
                                            displayName: 'Ay',
                                            sortOrder: 1,
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                },
            ],
        })
        const element = toStageMetadata(raw, STAGE_ID)
            .unwrap()
            .dataElements.get('deOptions01')
        expect(element).toEqual({
            id: 'deOptions01',
            label: 'Choice',
            description: 'Pick one',
            valueType: 'TEXT',
            compulsory: true,
            allowFutureDate: true,
            fieldMask: '999',
            options: [
                { id: 'optionA0001', code: 'A', label: 'Ay' },
                { id: 'optionB0001', code: 'B', label: 'Bee' },
            ],
            renderType: { desktop: 'HORIZONTAL_RADIOBUTTONS' },
        })
    })
})

describe('TrackerEventSchema', () => {
    it('parses a tracker event', () => {
        const event = TrackerEventSchema.parse(eventFixture)
        expect(event).toMatchObject({
            event: 'Evahwp3zrQ4',
            program: 'WSGAb5XwJ3Y',
            programStage: STAGE_ID,
            enrollment: 'PE6abx7Zhn0',
            orgUnit: 'm7fBMpmVpSM',
            status: 'ACTIVE',
            occurredAt: '2026-03-12T12:05:00.000',
        })
        expect(event.dataValues).toHaveLength(eventFixture.dataValues.length)
        expect(event.dataValues[0]).toEqual({
            dataElement: 'vANAXwtLwcT',
            value: '20',
        })
        expect(event.notes).toEqual([])
    })

    it('keeps notes and tolerates the absence of optional fields', () => {
        const event = TrackerEventSchema.parse({
            event: 'Tmpnote0001',
            program: 'WSGAb5XwJ3Y',
            programStage: STAGE_ID,
            orgUnit: 'm7fBMpmVpSM',
            status: 'COMPLETED',
            notes: [
                {
                    note: 'ZgsYvd5egUV',
                    storedAt: '2026-10-19T15:53:07.969',
                    value: 'A note',
                    storedBy: 'admin',
                    createdBy: {
                        uid: 'xE7jOejl9FI',
                        username: 'admin',
                        displayName: 'John Traore',
                    },
                },
            ],
            geometry: { type: 'Point', coordinates: [-11.9, 8.5] },
        })
        expect(event.enrollment).toBeUndefined()
        expect(event.dataValues).toEqual([])
        expect(event.geometry).toEqual({
            type: 'Point',
            coordinates: [-11.9, 8.5],
        })
        expect(event.notes).toEqual([
            {
                note: 'ZgsYvd5egUV',
                storedAt: '2026-10-19T15:53:07.969',
                value: 'A note',
                createdBy: {
                    uid: 'xE7jOejl9FI',
                    username: 'admin',
                    displayName: 'John Traore',
                },
            },
        ])
    })

    it('drops data values the server returns without a value', () => {
        // DHIS2 2.44 returns an empty data value as { dataElement } with no value.
        const event = TrackerEventSchema.parse({
            event: 'Tmpempty001',
            program: 'WSGAb5XwJ3Y',
            programStage: STAGE_ID,
            orgUnit: 'm7fBMpmVpSM',
            status: 'ACTIVE',
            dataValues: [
                { dataElement: 'w4ky6EkVahL', value: '2020-04-03' },
                { dataElement: 'VFffa31SKjH' },
                { dataElement: 'sdchiIXIcCf', value: null },
            ],
        })
        expect(event.dataValues).toEqual([
            { dataElement: 'w4ky6EkVahL', value: '2020-04-03' },
        ])
    })

    it('rejects an unknown status', () => {
        expect(
            TrackerEventSchema.safeParse({ ...eventFixture, status: 'DONE' })
                .success
        ).toBe(false)
    })
})

describe('SystemCalendarSchema', () => {
    it('normalises the DHIS2 date format', () => {
        expect(
            SystemCalendarSchema.parse({
                calendar: 'iso8601',
                dateFormat: 'yyyy-mm-dd',
                serverTimeZoneId: 'Etc/UTC',
            })
        ).toEqual({ calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' })
        expect(
            SystemCalendarSchema.parse({
                calendar: 'nepali',
                dateFormat: 'dd-MM-yyyy',
            })
        ).toEqual({ calendar: 'nepali', dateFormat: 'DD-MM-YYYY' })
    })

    it('rejects an unknown calendar', () => {
        expect(
            SystemCalendarSchema.safeParse({
                calendar: 'klingon',
                dateFormat: 'yyyy-mm-dd',
            }).success
        ).toBe(false)
    })
})
