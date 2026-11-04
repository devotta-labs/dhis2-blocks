import {
    EventsResponseSchema,
    MutationResponseSchema,
    TrackedEntitiesResponseSchema,
    TrackedEntityInstanceFiltersResponseSchema,
    TrackerProgramSchema,
} from '@/components/working-list/api/schemas'
import { describe, expect, it } from 'vitest'
import {
    ATTRIBUTES,
    DATA_ELEMENTS,
    generateWorld,
    type LabConfig,
} from './labData'
import { createLabServer } from './labServer'
import { parseFilters } from './query'
import { DEFAULT_CONFIG } from './presets'

const TODAY = '2026-11-02'

const server = (changes: {
    data?: Partial<LabConfig['data']>
    server?: Partial<LabConfig['server']>
}) => {
    const data = { ...DEFAULT_CONFIG.data, ...changes.data }
    return createLabServer(
        { data, server: { ...DEFAULT_CONFIG.server, ...changes.server } },
        generateWorld(data, TODAY)
    )
}

const people = async (
    respond: ReturnType<typeof server>,
    params: Record<string, string | number | string[]>
) =>
    TrackedEntitiesResponseSchema.parse(
        await respond({
            resource: 'tracker/trackedEntities',
            params: { page: 1, pageSize: 500, ...params },
        })
    )

const valuesOf = (
    response: Awaited<ReturnType<typeof people>>,
    attribute: string
) =>
    (response.trackedEntities ?? []).map(
        (person) =>
            person.attributes.find((each) => each.attribute === attribute)
                ?.value
    )

describe('the working list lab server', () => {
    it('answers with a program the block can read', async () => {
        const respond = server({})
        const program = TrackerProgramSchema.parse(
            await respond({ resource: 'programs', id: 'labProgram1' })
        )
        expect(program.programTrackedEntityAttributes).toHaveLength(8)
    })

    it('reads escaped filter values', () => {
        expect(
            parseFilters(['a:like:x/:y//z/,w', 'b:ge:1:le:5', 'c:!null'])
        ).toEqual([
            { field: 'a', operator: 'like', value: 'x:y/z,w' },
            { field: 'b', operator: 'ge', value: '1' },
            { field: 'b', operator: 'le', value: '5' },
            { field: 'c', operator: '!null' },
        ])
    })

    it('filters by attribute and sorts as asked', async () => {
        const response = await people(server({ data: { records: 40 } }), {
            filter: [`${ATTRIBUTES.sex}:in:M`],
            order: `${ATTRIBUTES.firstName}:desc`,
        })
        const names = valuesOf(response, ATTRIBUTES.firstName)
        expect(new Set(valuesOf(response, ATTRIBUTES.sex))).toEqual(
            new Set(['M'])
        )
        expect(names).toEqual(
            [...names].sort((left, right) =>
                String(right).localeCompare(String(left))
            )
        )
    })

    it('finds empty values only when asked', async () => {
        const respond = server({ data: { records: 60, emptyValues: 50 } })
        const empty = await people(respond, {
            filter: [`${ATTRIBUTES.phone}:null`],
        })
        expect(valuesOf(empty, ATTRIBUTES.phone).every((v) => !v)).toBe(true)
        expect(empty.trackedEntities?.length).toBeGreaterThan(0)
    })

    it('sends everything as stored when it ignores the query', async () => {
        const response = await people(
            server({ data: { records: 20 }, server: { query: 'ignored' } }),
            { filter: [`${ATTRIBUTES.sex}:in:M`] }
        )
        expect(response.trackedEntities).toHaveLength(20)
    })

    it('says there is a next page only on 2.42 and later', async () => {
        const params = { page: 1, pageSize: 15 }
        const current = await people(server({}), params)
        const older = await people(
            server({ server: { apiVersion: 41 } }),
            params
        )
        expect(current.pager?.nextPage).toBeDefined()
        expect(older.pager?.nextPage).toBeUndefined()
    })

    it('filters events by data value and status', async () => {
        const respond = server({ data: { mode: 'event', records: 80 } })
        const response = EventsResponseSchema.parse(
            await respond({
                resource: 'tracker/events',
                params: {
                    page: 1,
                    pageSize: 500,
                    status: 'COMPLETED',
                    filter: [`${DATA_ELEMENTS.weight}:ge:80`],
                },
            })
        )
        const events = response.events ?? []
        expect(events.length).toBeGreaterThan(0)
        for (const event of events) {
            expect(event.status).toBe('COMPLETED')
            const weight = event.dataValues.find(
                (each) => each.dataElement === DATA_ELEMENTS.weight
            )?.value
            expect(Number(weight)).toBeGreaterThanOrEqual(80)
        }
    })

    it('keeps the saved views the block creates and deletes', async () => {
        const respond = server({})
        const list = async () =>
            TrackedEntityInstanceFiltersResponseSchema.parse(
                await respond({ resource: 'trackedEntityInstanceFilters' })
            ).trackedEntityInstanceFilters.map((view) => view.displayName)
        const created = MutationResponseSchema.parse(
            await respond(
                {
                    resource: 'trackedEntityInstanceFilters',
                    data: {
                        name: 'My view',
                        program: { id: 'labProgram1' },
                    },
                },
                'create'
            )
        )
        expect(await list()).toContain('My view')
        await respond(
            {
                resource: 'trackedEntityInstanceFilters',
                id: created.response?.uid,
            },
            'delete'
        )
        expect(await list()).not.toContain('My view')
    })
})
