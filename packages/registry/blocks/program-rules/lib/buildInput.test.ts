import * as engine from '@dhis2/rule-engine'
import { buildEngineInput, type InputContext } from './buildInput'
import type { EventRuleInput, RuleEventInput } from './types'
import { normaliseValue, ruleValueType } from './valueTypes'

const context: InputContext = {
    programName: 'WHO RMNCH Tracker',
    stageNames: new Map([['stage', 'First visit']]),
    valueTypes: new Map([
        ['date', 'DATE'],
        ['datetime', 'DATETIME'],
        ['age', 'AGE'],
        ['attrDate', 'DATE'],
    ]),
}

const event = (overrides: Partial<RuleEventInput> = {}): RuleEventInput => ({
    id: 'event',
    programStageId: 'stage',
    orgUnitId: 'ou',
    status: 'ACTIVE',
    dataValues: {},
    ...overrides,
})

const build = (input: Partial<EventRuleInput>) =>
    buildEngineInput(engine, context, {
        event: event(),
        otherEvents: [],
        ...input,
    })

const values = (target: engine.RuleEventJs) =>
    Object.fromEntries(
        target.dataValues.map((value) => [value.dataElement, value.value])
    )

describe('buildEngineInput', () => {
    // Spike pitfall 1: tracker timestamps have no offset; the engine wants
    // yyyy-MM-dd dates and offset instants.
    it('cuts tracker timestamps to dates and gives instants an offset', () => {
        const { event: built } = build({
            event: event({
                occurredAt: '2026-03-12T12:05:00.000',
                scheduledAt: '2026-03-10T00:00:00.000',
                completedAt: '2026-03-13T08:00:00.000',
                createdAt: '2026-03-12T12:05:00.000',
            }),
        })
        expect(built.eventDate?.toString()).toBe('2026-03-12')
        expect(built.dueDate?.toString()).toBe('2026-03-10')
        expect(built.completedDate?.toString()).toBe('2026-03-13')
        expect(built.createdDate.toString()).toContain('2026-03-12T12:05')
        expect(built.programStageName).toBe('First visit')
    })

    it('cuts DATETIME and AGE values read through date variables to dates', () => {
        const { event: built } = build({
            event: event({
                dataValues: {
                    datetime: '2026-03-12T10:00:00.000',
                    age: '1990-05-01T00:00:00.000',
                    date: '2026-03-12',
                    text: 'T10:00',
                },
            }),
        })
        expect(values(built)).toEqual({
            datetime: '2026-03-12',
            age: '1990-05-01',
            date: '2026-03-12',
            text: 'T10:00',
        })
    })

    it('treats half-typed dates as missing instead of failing', () => {
        const { event: built } = build({
            event: event({
                occurredAt: '2026-1',
                createdAt: 'nonsense',
                dataValues: { date: '2026-1', datetime: '2026-13-45T00:00' },
            }),
        })
        expect(built.eventDate).toBeNull()
        expect(values(built)).toEqual({})
    })

    // Spike pitfall 2: d2:hasValue is true for '', so empty values are left out.
    it('leaves empty values out', () => {
        const built = build({
            event: event({ dataValues: { a: '', b: 'x' } }),
            enrollment: {
                id: 'en',
                enrolledAt: '2026-01-01',
                orgUnitId: 'ou',
                attributes: { c: '', d: 'y' },
            },
        })
        expect(values(built.event)).toEqual({ b: 'x' })
        expect(
            built.enrollment?.attributeValues.map((a) => [
                a.trackedEntityAttribute,
                a.value,
            ])
        ).toEqual([['d', 'y']])
    })

    // Spike pitfall 11: the current event must not compete with itself.
    it('drops the current event from the other events', () => {
        const built = build({
            otherEvents: [event(), event({ id: 'other' })],
        })
        expect(built.otherEvents.map((other) => other.event)).toEqual(['other'])
    })

    it('falls back to ACTIVE, no enrollment and the enrollment date', () => {
        expect(build({}).enrollment).toBeNull()
        const built = build({
            enrollment: {
                id: 'en',
                enrolledAt: '2026-01-02T00:00:00.000',
                orgUnitId: 'ou',
                orgUnitCode: 'OU_1',
                attributes: { attrDate: '2026-01-01' },
            },
        })
        expect(built.enrollment?.incidentDate.toString()).toBe('2026-01-02')
        expect(built.enrollment?.enrollmentDate.toString()).toBe('2026-01-02')
        expect(built.enrollment?.status.name).toBe('ACTIVE')
        expect(built.enrollment?.organisationUnitCode).toBe('OU_1')
        expect(build({}).event.status.name).toBe('ACTIVE')
        expect(
            build({ event: event({ status: 'COMPLETED' }) }).event.status.name
        ).toBe('COMPLETED')
    })
})

describe('ruleValueType', () => {
    // Spike pitfall 9.
    it.each([
        ['NUMBER', 'NUMERIC'],
        ['INTEGER', 'NUMERIC'],
        ['INTEGER_POSITIVE', 'NUMERIC'],
        ['INTEGER_NEGATIVE', 'NUMERIC'],
        ['INTEGER_ZERO_OR_POSITIVE', 'NUMERIC'],
        ['PERCENTAGE', 'NUMERIC'],
        ['UNIT_INTERVAL', 'NUMERIC'],
        ['BOOLEAN', 'BOOLEAN'],
        ['TRUE_ONLY', 'BOOLEAN'],
        ['DATE', 'DATE'],
        ['DATETIME', 'DATE'],
        ['AGE', 'DATE'],
        ['TEXT', 'TEXT'],
        ['PHONE_NUMBER', 'TEXT'],
        [undefined, 'TEXT'],
    ])('maps %s to %s', (valueType, expected) => {
        expect(ruleValueType(engine, valueType).name).toBe(expected)
    })
})

describe('normaliseValue', () => {
    it('drops empty values and keeps others', () => {
        expect(normaliseValue('', 'TEXT')).toBeNull()
        expect(normaliseValue(undefined, 'TEXT')).toBeNull()
        expect(normaliseValue('5', 'NUMBER')).toBe('5')
    })
})
