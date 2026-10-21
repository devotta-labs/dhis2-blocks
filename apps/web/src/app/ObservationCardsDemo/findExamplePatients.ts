import type { useDataEngine } from '@dhis2/app-runtime'
import { z } from 'zod'

export interface ExamplePatient {
    trackedEntityId: string
    /** How many of the wanted data elements have at least one value. */
    elementsCovered: number
    /** Values recorded across the wanted data elements. */
    readings: number
}

const EventSchema = z.object({
    trackedEntity: z.string().optional(),
    dataValues: z.array(z.object({ dataElement: z.string() })).optional(),
})

/**
 * The engine nests the tracker list under the query key. Current servers
 * return `events`; 2.41 returns the legacy `instances`.
 */
const ResponseSchema = z.object({
    events: z
        .object({
            events: z.array(EventSchema).optional(),
            instances: z.array(EventSchema).optional(),
        })
        .transform((page) => page.events ?? page.instances ?? []),
})

type DataEngine = ReturnType<typeof useDataEngine>

const PAGE_SIZE = 200
const MAX_PAGES = 3
const TOP = 5

/**
 * Samples recent events in the program and ranks the people in them by how
 * much of the wanted data they have, so the demo can open one that fills the
 * cards. It only sees the sampled pages, which is enough to pick a good
 * example but not to claim it is the best in the instance.
 */
export const findExamplePatients = async (
    engine: DataEngine,
    programId: string,
    dataElementIds: ReadonlyArray<string>
): Promise<ExamplePatient[]> => {
    const wanted = new Set(dataElementIds)
    const byPerson = new Map<
        string,
        { covered: Set<string>; readings: number }
    >()

    for (let page = 1; page <= MAX_PAGES; page++) {
        const response = ResponseSchema.parse(
            await engine.query({
                events: {
                    resource: 'tracker/events',
                    params: {
                        program: programId,
                        fields: 'trackedEntity,dataValues[dataElement]',
                        order: 'occurredAt:desc',
                        pageSize: PAGE_SIZE,
                        page,
                    },
                },
            })
        )
        const events = response.events

        for (const event of events) {
            if (event.trackedEntity === undefined) {
                continue
            }
            const entry = byPerson.get(event.trackedEntity) ?? {
                covered: new Set<string>(),
                readings: 0,
            }
            for (const { dataElement } of event.dataValues ?? []) {
                if (wanted.has(dataElement)) {
                    entry.covered.add(dataElement)
                    entry.readings += 1
                }
            }
            byPerson.set(event.trackedEntity, entry)
        }
        if (events.length < PAGE_SIZE) {
            break
        }
    }

    return [...byPerson.entries()]
        .map(([trackedEntityId, { covered, readings }]) => ({
            trackedEntityId,
            elementsCovered: covered.size,
            readings,
        }))
        .filter((patient) => patient.readings > 0)
        .sort(
            (a, b) =>
                b.elementsCovered - a.elementsCovered ||
                b.readings - a.readings ||
                a.trackedEntityId.localeCompare(b.trackedEntityId)
        )
        .slice(0, TOP)
}
