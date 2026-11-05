import { describe, expect, test } from 'vitest'
import { cellKey } from '@/components/spreadsheet'
import type { DataEngine } from '@/components/spreadsheet'
import immunisation from './__tests__/fixtures/immunisation-program.json'
import { compileLayout } from './compileLayout'
import type { RegisterLayout } from './layout'
import { registerMetadataOf, registerProgramSchema } from './metadata'
import { newPerson, reservedValues } from './newPerson'

type Request = Parameters<DataEngine['query']>[0]

const PROGRAM = 'ImmReg00001'
const NGELEHUN = 'DiszpKrYNg8'
const FIRST_NAME = 'w75KJ2mc4zz'
const LAST_NAME = 'zDhUuAYrxNC'
const VACCINATION = 'ImmVaccin01'
const VACCINE = 'ImmVaccine1'
const DOSE = 'ImmDose0001'
const BCG = `${VACCINATION}?${DOSE}=0&${VACCINE}=BCG`
const UNIQUE_ID = 'lZGmxYbs97q'

const LAYOUT: RegisterLayout = {
    columns: [
        { field: { attribute: FIRST_NAME } },
        { field: { attribute: LAST_NAME } },
        { field: { attribute: 'gHGyrwKPzej' } },
        { field: { enrollment: 'enrolledAt' } },
        {
            field: {
                stage: VACCINATION,
                where: { [VACCINE]: 'BCG', [DOSE]: '0' },
                eventDate: true,
            },
        },
        { field: { stage: VACCINATION, occurrence: 1, eventDate: true } },
    ],
}

const metadata = registerMetadataOf(registerProgramSchema.parse(immunisation))
const compiled = (() => {
    const result = compileLayout(LAYOUT, metadata)
    if (!result.ok) {
        throw new Error(result.errors.join('; '))
    }
    return result.compiled
})()

describe('newPerson', () => {
    test('mints a person, an enrolment and one event per slot at the org unit', () => {
        const { row, records } = newPerson(compiled, metadata, NGELEHUN)
        const { person, enrollment } = row.slots ?? {}
        expect(row).toEqual({
            id: enrollment,
            label: 'New person',
            slots: {
                person,
                enrollment,
                [BCG]: expect.any(String),
                [`${VACCINATION}#1`]: expect.any(String),
            },
            labelFrom: [
                cellKey(person, FIRST_NAME),
                cellKey(person, LAST_NAME),
            ],
        })
        const ids = Object.values(row.slots ?? {})
        expect(new Set(ids).size).toBe(4)
        expect(ids.every((id) => /^[A-Za-z][A-Za-z\d]{10}$/.test(id))).toBe(
            true
        )
        expect(records).toEqual([
            {
                kind: 'trackedEntity',
                id: person,
                trackedEntityTypeId: 'nEenWmSyUEp',
                orgUnitId: NGELEHUN,
                isNew: true,
            },
            {
                kind: 'enrollment',
                id: enrollment,
                programId: PROGRAM,
                trackedEntityId: person,
                orgUnitId: NGELEHUN,
                status: 'ACTIVE',
                isNew: true,
            },
            {
                kind: 'event',
                id: row.slots?.[BCG],
                programStageId: VACCINATION,
                orgUnitId: NGELEHUN,
                enrollmentId: enrollment,
                status: 'ACTIVE',
                isNew: true,
                slot: BCG,
                // The slot's values, which no column shows, go with the event.
                createdWith: { [VACCINE]: 'BCG', [DOSE]: '0' },
                // A reload rebuilds the row from this event alone.
                trackedEntityId: person,
            },
            {
                kind: 'event',
                id: row.slots?.[`${VACCINATION}#1`],
                programStageId: VACCINATION,
                orgUnitId: NGELEHUN,
                enrollmentId: enrollment,
                status: 'ACTIVE',
                isNew: true,
                slot: `${VACCINATION}#1`,
                trackedEntityId: person,
            },
        ])
    })
})

describe('reservedValues', () => {
    /** DHIS2 reserving numbered values, each request after the last. */
    const reserving = (refusal?: Error) => {
        const requests: Request[] = []
        let next = 0
        // SAFETY: reserving only calls `query`.
        const engine = {
            query: async (request: Request) => {
                requests.push(request)
                if (refusal !== undefined) {
                    throw refusal
                }
                // SAFETY: a reservation's params are `{ numberToReserve }`.
                const { numberToReserve } = request.reserved.params as {
                    numberToReserve: number
                }
                const count = numberToReserve
                return {
                    reserved: Array.from({ length: count }, () => ({
                        ownerObject: 'TRACKEDENTITYATTRIBUTE',
                        ownerUid: UNIQUE_ID,
                        key: 'RANDOM(#######)',
                        value: String(++next),
                        created: '2026-11-03T09:00:00.000',
                        expiryDate: '2027-01-02T09:00:00.000',
                    })),
                }
            },
        } as DataEngine
        return { engine, requests }
    }
    const ask = (numberToReserve: number) => ({
        reserved: {
            resource: `trackedEntityAttributes/${UNIQUE_ID}/generateAndReserve`,
            params: { numberToReserve },
        },
    })

    test('reserves ten values per attribute, and refills to ten when fewer than three are left', async () => {
        const { engine, requests } = reserving()
        const values = reservedValues([UNIQUE_ID])
        await values.fill(engine)
        expect(requests).toEqual([ask(10)])
        const taken = Array.from({ length: 8 }, () =>
            values.take(engine).get(UNIQUE_ID)
        )
        expect(taken).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
        // Two left: it tops up to ten, once.
        expect(requests).toEqual([ask(10), ask(8)])
        await Promise.resolve()
        expect(values.take(engine).get(UNIQUE_ID)).toBe('9')
    })

    test('with none left the value is left out', async () => {
        const { engine: failing } = reserving(new Error('No pattern'))
        const values = reservedValues([UNIQUE_ID])
        await values.fill(failing)
        expect(values.take(failing)).toEqual(new Map())
    })
})
