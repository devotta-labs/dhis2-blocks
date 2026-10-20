import { readFileSync } from 'node:fs'
import { z } from 'zod'
import {
    DataElementsResponseSchema,
    EventsResponseSchema,
    ProgramStagesResponseSchema,
} from './schemas'

const fixture = (name: string) =>
    z
        .json()
        .parse(
            JSON.parse(
                readFileSync(
                    new URL(`./__fixtures__/${name}`, import.meta.url),
                    'utf8'
                )
            )
        )

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
})

describe('ProgramStagesResponseSchema', () => {
    it('maps access.data.read to canReadData and flattens data element ids', () => {
        const stages = ProgramStagesResponseSchema.parse(
            fixture('program.dev.json')
        )

        expect(stages).toHaveLength(5)
        expect(stages.find((s) => s.id === 'bbKtnxRZKEP')).toEqual({
            id: 'bbKtnxRZKEP',
            displayName: expect.any(String),
            canReadData: true,
            dataElementIds: expect.arrayContaining(['vANAXwtLwcT']),
        })
    })

    it('reads an explicit false as not readable', () => {
        const [stage] = ProgramStagesResponseSchema.parse({
            programStages: [
                {
                    id: 's1',
                    displayName: 'Stage',
                    access: { data: { read: false } },
                    programStageDataElements: [{ dataElement: { id: 'de1' } }],
                },
            ],
        })

        expect(stage).toEqual({
            id: 's1',
            displayName: 'Stage',
            canReadData: false,
            dataElementIds: ['de1'],
        })
    })

    it('treats an absent access block as readable', () => {
        const [stage] = ProgramStagesResponseSchema.parse({
            programStages: [
                {
                    id: 's1',
                    displayName: 'Stage',
                    programStageDataElements: [],
                },
            ],
        })

        expect(stage?.canReadData).toBe(true)
    })
})

describe('DataElementsResponseSchema', () => {
    const parse = () =>
        DataElementsResponseSchema.parse(fixture('dataElements.dev.json'))

    it('parses a data element with a legend set', () => {
        const element = parse().find((e) => e.id === 'qrur9Dvnyt5')

        expect(element?.valueType).toBe('INTEGER')
        expect(element?.legendSets?.[0]?.legends[0]).toEqual({
            name: expect.any(String),
            color: expect.stringMatching(/^#/),
            startValue: expect.any(Number),
            endValue: expect.any(Number),
        })
    })

    it('parses an option set whose options carry a style colour', () => {
        const element = parse().find((e) => e.id === 'CLC5VYdZBay')

        expect(element?.optionSet?.options[0]).toEqual({
            code: 'ACT x6',
            name: 'ACT x6',
            style: { color: 'ffef78' },
        })
    })

    it('leaves absent form name and option set undefined', () => {
        const element = DataElementsResponseSchema.parse({
            dataElements: [
                {
                    id: 'd',
                    displayName: 'D',
                    valueType: 'NUMBER',
                    optionSet: null,
                },
            ],
        })[0]

        expect(element?.displayFormName).toBeUndefined()
        expect(element?.optionSet).toBeUndefined()
    })
})
