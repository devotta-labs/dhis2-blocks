import { cellKey } from '@/components/spreadsheet'
import type { DataEngine } from '@/components/spreadsheet'
import type { DataRecord } from '../../model/types'
import type { OutboxRecord } from '../../outbox/outbox'
import meAdmin from '../../sources/__tests__/fixtures/me-admin.json'
import systemInfo from '../../sources/__tests__/fixtures/system-info.json'
import { trackerEngine } from '../../sources/__tests__/trackerRig'
import type { RegisterLayout } from '../layout'
import { registerSource } from '../registerSource'
import type { RegisterSourceOptions } from '../registerSource'
import enrollments from './fixtures/immunisation-enrollments.json'
import immunisation from './fixtures/immunisation-program.json'

/** The child immunisation register on the seeded program, as the source tests load it. */

type Request = Parameters<DataEngine['query']>[0]

export const PROGRAM = 'ImmReg00001'
export const PERSON_TYPE = 'nEenWmSyUEp'
export const NGELEHUN = 'DiszpKrYNg8'
export const FIRST_NAME = 'w75KJ2mc4zz'
export const LAST_NAME = 'zDhUuAYrxNC'
export const BIRTH_DATE = 'gHGyrwKPzej'
export const VACCINATION = 'ImmVaccin01'
export const VACCINE = 'ImmVaccine1'
export const DOSE = 'ImmDose0001'
export const ENROLLED_AT = 'enrolledAt'

/** A dose's slot, as the layout names it: its values sorted by data element id. */
const doseSlot = (vaccine: string, dose: string) =>
    `${VACCINATION}?${DOSE}=${dose}&${VACCINE}=${vaccine}`
export const BCG = doseSlot('BCG', '0')
export const OPV_1 = doseSlot('OPV', '1')
export const DPT_1 = doseSlot('DPT', '1')
export const DPT_2 = doseSlot('DPT', '2')

const doseDate = (vaccine: string, dose: string) => ({
    label: `${vaccine} ${dose}`,
    field: {
        stage: VACCINATION,
        where: { [VACCINE]: vaccine, [DOSE]: dose },
        eventDate: true as const,
    },
})

export const LAYOUT: RegisterLayout = {
    programId: PROGRAM,
    columns: [
        {
            group: 'Child',
            children: [
                { field: { attribute: FIRST_NAME } },
                { field: { attribute: LAST_NAME } },
                { field: { attribute: BIRTH_DATE } },
            ],
        },
        { label: 'Registered', field: { enrollment: ENROLLED_AT } },
        {
            group: 'Doses',
            children: [
                doseDate('BCG', '0'),
                doseDate('OPV', '1'),
                doseDate('DPT', '1'),
                doseDate('DPT', '2'),
            ],
        },
    ],
}

/**
 * DHIS2 answering each part of a query by its name (`answers` over the immunisation register's), any save read with
 * nothing held, and each import as saved whole.
 */
export const engineFor = (
    answers: {
        program?: object
        enrollments?: object
        reserved?: Array<{ value: string }>
        /** What a reload's lookup finds of people and enrolments; an error when DHIS2 cannot be reached. */
        held?: object | Error
    } = {}
) => {
    const requests: Request[] = []
    const all = Object.entries({
        program: immunisation,
        enrollments,
        me: meAdmin,
        systemInfo,
        rules: { programRules: [] },
        held: { trackedEntities: [], enrollments: [] },
        ...answers,
    })
    const saving = trackerEngine({})
    // SAFETY: the source calls only `query` and `mutate`; both answer as DHIS2 would for what it sends.
    const engine = {
        query: async (request: Request) => {
            requests.push(request)
            const failing = all.find(
                ([name, answer]) => name in request && answer instanceof Error
            )?.[1]
            if (failing instanceof Error) {
                throw failing
            }
            return Object.fromEntries(
                Object.entries(request).map(([name, { resource }]) => [
                    name,
                    name === 'current'
                        ? { [resource.slice('tracker/'.length)]: [] }
                        : all.find(([answered]) => answered === name)?.[1],
                ])
            )
        },
        mutate: saving.engine.mutate,
    } as DataEngine
    return { engine, requests, mutations: saving.mutations }
}

export const immunisationRegister = (
    options: Partial<RegisterSourceOptions> = {}
) =>
    registerSource({
        programId: PROGRAM,
        orgUnitId: NGELEHUN,
        enrolledFrom: '2026-10-01',
        enrolledTo: '2026-10-31',
        layout: LAYOUT,
        today: '2026-11-03',
        ...options,
    })

/** The fixture with the enrolments changed by `change`. */
export const enrolledAs = (
    change: (
        enrollment: (typeof enrollments.enrollments)[number],
        at: number
    ) => object
) => ({ ...enrollments, enrollments: enrollments.enrollments.map(change) })

let clock = 0
export const edit = (
    record: DataRecord,
    field: string,
    value: string
): OutboxRecord => ({
    sourceKey: `register:${PROGRAM}`,
    key: cellKey(record.id, field),
    value,
    base: null,
    at: ++clock,
    state: 'queued',
    record,
})
