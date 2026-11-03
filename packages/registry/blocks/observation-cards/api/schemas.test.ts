import type { z } from 'zod'
import { fixture, programMetadataResponse } from '../__tests__/fixtures'
import {
    EnrollmentsResponseSchema,
    EventsResponseSchema,
    ProgramMetadataResponseSchema,
} from './schemas'

describe('EventsResponseSchema', () => {
    it('parses the dev `events` envelope, keeping dates as received', () => {
        const records = EventsResponseSchema.parse(fixture('events.dev.json'))

        expect(records).toHaveLength(4)
        expect(records[0]).toMatchObject({
            event: 'vB3Hgar8r8k',
            programStage: 'bbKtnxRZKEP',
            status: 'ACTIVE',
            occurredAt: '2026-09-19T12:05:00.000',
            createdAt: '2018-01-26T13:48:13.362',
        })
        expect(records[0]?.dataValues).toContainEqual({
            dataElement: 'vANAXwtLwcT',
            value: '23',
        })
    })

    // events.v41.json is NOT a 2.41 recording: no reachable 2.41 instance was
    // available, so it is the dev recording with the envelope key renamed from
    // `events` to `instances` (the legacy shape Working List also accepts).
    it('parses the legacy 2.41 `instances` envelope to the same records', () => {
        expect(EventsResponseSchema.parse(fixture('events.v41.json'))).toEqual(
            EventsResponseSchema.parse(fixture('events.dev.json'))
        )
    })

    it('rejects a body with neither envelope key', () => {
        expect(EventsResponseSchema.safeParse({ pager: {} }).success).toBe(
            false
        )
    })

    it('defaults missing dataValues to an empty list', () => {
        const [record] = EventsResponseSchema.parse({
            events: [{ event: 'e1', programStage: 's1', status: 'ACTIVE' }],
        })

        expect(record?.dataValues).toEqual([])
        expect(record?.occurredAt).toBeUndefined()
    })

    it('skips a null or missing value instead of failing the response', () => {
        const [record] = EventsResponseSchema.parse({
            events: [
                {
                    event: 'e1',
                    programStage: 's1',
                    status: 'ACTIVE',
                    dataValues: [
                        { dataElement: 'de1', value: null },
                        { dataElement: 'de2' },
                        { dataElement: 'de3', value: '7' },
                    ],
                },
            ],
        })

        expect(record?.dataValues).toEqual([{ dataElement: 'de3', value: '7' }])
    })

    it('keeps the tracked entity an event reports', () => {
        const [record] = EventsResponseSchema.parse({
            instances: [
                {
                    event: 'e1',
                    trackedEntity: 'te1',
                    programStage: 's1',
                    status: 'ACTIVE',
                },
            ],
        })

        expect(record?.trackedEntity).toBe('te1')
    })
})

describe('EnrollmentsResponseSchema', () => {
    it('reads both the enrollments and the legacy instances envelope', () => {
        const enrollments = [{ enrollment: 'en1' }]

        expect(EnrollmentsResponseSchema.parse({ enrollments })).toEqual(
            enrollments
        )
        expect(
            EnrollmentsResponseSchema.parse({ instances: enrollments })
        ).toEqual(enrollments)
    })

    it('rejects a body with neither envelope key', () => {
        expect(EnrollmentsResponseSchema.safeParse({ pager: {} }).success).toBe(
            false
        )
    })
})

type StageInput = NonNullable<
    z.input<typeof ProgramMetadataResponseSchema>['programStages']
>[number]

describe('ProgramMetadataResponseSchema', () => {
    const parse = () =>
        ProgramMetadataResponseSchema.parse(programMetadataResponse())

    const oneStage = (stage: Omit<StageInput, 'id' | 'displayName'>) =>
        ProgramMetadataResponseSchema.parse({
            programStages: [{ id: 's1', displayName: 'Stage', ...stage }],
        }).stages[0]

    it('maps access.data.read to canReadData and flattens data element ids', () => {
        const { stages } = parse()

        expect(stages).toHaveLength(5)
        expect(stages.find((s) => s.id === 'bbKtnxRZKEP')).toEqual({
            id: 'bbKtnxRZKEP',
            displayName: expect.any(String),
            canReadData: true,
            dataElementIds: expect.arrayContaining(['vANAXwtLwcT']),
        })
    })

    it('keeps each data element once, however many stages capture it', () => {
        const { dataElements } = parse()

        expect([...dataElements.keys()].sort()).toEqual(
            [
                'CLC5VYdZBay',
                'EyfTU3ibMmJ',
                'Itl05OEupgQ',
                'qrur9Dvnyt5',
                'sWoqcoByYmD',
                'vANAXwtLwcT',
            ].sort()
        )
    })

    it('reads an explicit false as not readable', () => {
        expect(
            oneStage({
                access: { data: { read: false } },
                programStageDataElements: [
                    {
                        dataElement: {
                            id: 'de1',
                            displayName: 'D',
                            valueType: 'NUMBER',
                        },
                    },
                ],
            })
        ).toEqual({
            id: 's1',
            displayName: 'Stage',
            canReadData: false,
            dataElementIds: ['de1'],
        })
    })

    it('treats an absent access block as readable', () => {
        expect(oneStage({ programStageDataElements: [] })?.canReadData).toBe(
            true
        )
    })

    it('parses a data element with a legend set', () => {
        const element = parse().dataElements.get('qrur9Dvnyt5')

        expect(element?.valueType).toBe('INTEGER')
        expect(element?.legendSets?.[0]?.legends[0]).toEqual({
            name: expect.any(String),
            color: expect.stringMatching(/^#/),
            startValue: expect.any(Number),
            endValue: expect.any(Number),
        })
    })

    it('parses an option set whose options carry a style colour', () => {
        const element = parse().dataElements.get('CLC5VYdZBay')

        expect(element?.optionSet?.options[0]).toEqual({
            code: 'ACT x6',
            name: 'ACT x6',
            style: { color: 'ffef78' },
        })
    })

    it('leaves absent form name and option set undefined', () => {
        const element = ProgramMetadataResponseSchema.parse({
            programStages: [
                {
                    id: 's1',
                    displayName: 'Stage',
                    programStageDataElements: [
                        {
                            dataElement: {
                                id: 'd',
                                displayName: 'D',
                                valueType: 'NUMBER',
                                optionSet: null,
                            },
                        },
                    ],
                },
            ],
        }).dataElements.get('d')

        expect(element?.displayFormName).toBeUndefined()
        expect(element?.optionSet).toBeUndefined()
    })

    const elements = (...dataElements: unknown[]) =>
        ProgramMetadataResponseSchema.parse({
            programStages: [
                {
                    id: 's1',
                    displayName: 'Stage',
                    programStageDataElements: dataElements.map(
                        (dataElement) => ({ dataElement })
                    ),
                },
            ],
        })

    const ok = { id: 'ok', displayName: 'OK', valueType: 'NUMBER' }

    it('keeps a legend with no colour, without one', () => {
        const legends = elements({
            ...ok,
            legendSets: [
                {
                    legends: [
                        { name: 'Low', startValue: 0, endValue: 5 },
                        {
                            name: 'High',
                            color: null,
                            startValue: 5,
                            endValue: 9,
                        },
                    ],
                },
            ],
        }).dataElements.get('ok')?.legendSets?.[0]?.legends

        expect(legends).toEqual([
            { name: 'Low', color: undefined, startValue: 0, endValue: 5 },
            { name: 'High', color: undefined, startValue: 5, endValue: 9 },
        ])
    })

    it('drops a malformed legend on its own', () => {
        const legends = elements({
            ...ok,
            legendSets: [
                {
                    legends: [
                        { name: 'Low', color: '#f00', startValue: 'x' },
                        {
                            name: 'High',
                            color: '#0f0',
                            startValue: 5,
                            endValue: 9,
                        },
                    ],
                },
            ],
        }).dataElements.get('ok')?.legendSets?.[0]?.legends

        expect(legends).toEqual([
            { name: 'High', color: '#0f0', startValue: 5, endValue: 9 },
        ])
    })

    it('a malformed data element is invalid on its own, with its name kept', () => {
        const metadata = elements(ok, {
            id: 'bad',
            displayName: 'Bad',
            valueType: 'TEXT',
            // A broken option set is never dropped: it would show raw codes.
            optionSet: { options: [{ code: 'A' }] },
        })

        expect([...metadata.dataElements.keys()]).toEqual(['ok'])
        expect(metadata.invalidDataElements.get('bad')).toEqual({
            displayName: 'Bad',
            error: expect.objectContaining({
                message: expect.stringContaining(
                    "Data element bad has metadata this card can't read"
                ),
            }),
        })
        // Still captured, so its card is an error rather than misconfigured.
        expect(metadata.stages[0]?.dataElementIds).toEqual(['ok', 'bad'])
    })

    it('one odd stage never fails the program', () => {
        const element = (id: string) => ({
            dataElement: { id, displayName: id, valueType: 'NUMBER' },
        })
        const metadata = ProgramMetadataResponseSchema.parse({
            programStages: [
                {
                    id: 'good',
                    displayName: 'Good',
                    programStageDataElements: [element('a')],
                },
                // No name, and an access block that can't be read.
                {
                    id: 'odd',
                    access: { data: { read: 'yes' } },
                    programStageDataElements: [element('b')],
                },
                // No id: left out of the stages, but its data element is still read.
                {
                    displayName: 'No id',
                    programStageDataElements: [element('c')],
                },
                // Not a stage at all.
                'nonsense',
                { id: 'broken', programStageDataElements: 'nonsense' },
            ],
        })

        expect(metadata.stages).toEqual([
            {
                id: 'good',
                displayName: 'Good',
                canReadData: true,
                dataElementIds: ['a'],
            },
            // Unreadable access never claims the stage is readable.
            {
                id: 'odd',
                displayName: 'odd',
                canReadData: false,
                dataElementIds: ['b'],
            },
            {
                id: 'broken',
                displayName: 'broken',
                canReadData: true,
                dataElementIds: [],
            },
        ])
        expect([...metadata.dataElements.keys()]).toEqual(['a', 'b', 'c'])
    })

    it('drops a data element entry without an id', () => {
        const metadata = elements(ok, { displayName: 'No id' })

        expect(metadata.stages[0]?.dataElementIds).toEqual(['ok'])
        expect(metadata.invalidDataElements.size).toBe(0)
    })
})
