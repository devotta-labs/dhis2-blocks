import type { CustomDataProvider } from '@dhis2/app-runtime'
import type { ComponentProps } from 'react'
import { z } from 'zod'
import {
    RMNCH,
    rmnchEnrollmentResponse,
    rmnchResponses,
} from '@/components/program-rules/__tests__/rmnch'
import meAdmin from '../../sources/__tests__/fixtures/me-admin.json'
import rmnchProgram from '../../sources/__tests__/fixtures/rmnch-program.json'
import systemInfo from '../../sources/__tests__/fixtures/system-info.json'
import { eventSource } from '../../sources/eventSource'
import type { DataEngine } from '../../sources/types'

const ANTENATAL = new Set<string>([RMNCH.stageId, 'edqlbukwRfQ'])

export interface FixtureEvent {
    event: string
    enrollment: string
    programStage: string
    orgUnit: string
    occurredAt: string
    status: string
    dataValues: Array<{ dataElement: string; value: string }>
}

/** Person `k`, a copy of the RMNCH person whose ids end in `k`; person 0 is the fixture's own. */
export const personId = (k: number) => `${RMNCH.enrollmentId.slice(0, -1)}${k}`
export const eventId = (id: string, k: number) =>
    k === 0 ? id : `${id.slice(0, -1)}${k}`

/** Person `k`'s events, as the server has them. */
export const eventsOf = (k: number): FixtureEvent[] =>
    rmnchEnrollmentResponse.events.map((event) => ({
        event: eventId(event.event, k),
        enrollment: personId(k),
        programStage: event.programStage,
        orgUnit: event.orgUnit,
        occurredAt: event.occurredAt,
        status: event.status,
        dataValues: event.dataValues.map(({ dataElement, value }) => ({
            dataElement,
            value,
        })),
    }))

export const antenatalOf = (k: number) =>
    eventsOf(k).filter(({ programStage }) => ANTENATAL.has(programStage))

/** What the server sends: plain JSON, no `undefined` members. */
const json = <T>(body: T) => z.json().parse(JSON.parse(JSON.stringify(body)))

export const answering = <T>(answer: T) =>
    // SAFETY: loading only calls `query`, which answers every request with the fixtures.
    ({
        query: async (_query: Parameters<DataEngine['query']>[0]) => answer,
    }) as DataEngine

/** The RMNCH grid of a facility's events: every person's, oldest first. */
export const rmnchSource = eventSource({
    programId: RMNCH.programId,
    orgUnitId: 'm7fBMpmVpSM',
    order: 'occurredAt:asc',
    today: '2026-10-26',
})

/** The grid `eventSource` loads for these RMNCH events. */
export const rmnchForm = (events: ReadonlyArray<FixtureEvent>) =>
    rmnchSource.load(
        answering({
            program: rmnchProgram,
            events: { events },
            me: meAdmin,
            systemInfo,
        })
    )

/** The person the server answers for an enrollment id: the RMNCH person with that id's events. */
export const fixturePerson = (id: string) => ({
    ...rmnchEnrollmentResponse,
    enrollment: id,
    events: eventsOf(Number(id.at(-1))),
})

/** The RMNCH rules, and every person asked for, as `personOf` gives them. */
export const rulesFor = (
    personOf: (
        id: string
    ) =>
        | ReturnType<typeof fixturePerson>
        | Promise<ReturnType<typeof fixturePerson>> = fixturePerson
) =>
    ({
        programRules: async () => json(rmnchResponses.rules),
        programRuleVariables: async () => json(rmnchResponses.variables),
        constants: async () => json(rmnchResponses.constants),
        programs: async () => json(rmnchResponses.program),
        'tracker/enrollments': async (_type, query) =>
            json({
                pager: { page: 1, pageSize: 100 },
                enrollments: await Promise.all(
                    String(query.params?.enrollments).split(',').map(personOf)
                ),
            }),
    }) satisfies ComponentProps<typeof CustomDataProvider>['data']
