import {
    normaliseProgram,
    normaliseTrackedEntities,
    ProgramResponseSchema,
    TrackedEntitiesResponseSchema,
} from './schemas'

const link = (
    id: string,
    extra: { sortOrder?: number } = {},
    attribute: {
        displayFormName?: string
        preferredSearchOperator?: string
        blockedSearchOperators?: string[]
        minCharactersToSearch?: number
    } = {}
) => ({
    searchable: true,
    displayInList: false,
    trackedEntityAttribute: {
        id,
        displayName: `Name ${id}`,
        valueType: 'TEXT',
        ...attribute,
    },
    ...extra,
})

const program = (body: {
    programTrackedEntityAttributes?: ReturnType<typeof link>[]
}) =>
    normaliseProgram(
        'prog',
        ProgramResponseSchema.parse({
            displayName: 'HIV',
            trackedEntityType: { id: 'tet' },
            programTrackedEntityAttributes: [],
            ...body,
        })
    )

describe('program metadata', () => {
    it('orders attributes by sortOrder', () => {
        const metadata = program({
            programTrackedEntityAttributes: [
                link('c', { sortOrder: 3 }),
                link('none'),
                link('a', { sortOrder: 1 }),
                link('b', { sortOrder: 1 }),
            ],
        })
        expect(metadata.attributes.map((a) => a.id)).toEqual([
            'a',
            'b',
            'c',
            'none',
        ])
    })

    it('defaults min to 1 and cap to 0', () => {
        const metadata = program({})
        expect(metadata).toMatchObject({
            program: 'prog',
            name: 'HIV',
            trackedEntityType: 'tet',
            minAttributesRequiredToSearch: 1,
            maxTeiCountToReturn: 0,
        })
    })

    it('lower-cases operators and prefers displayFormName', () => {
        const metadata = program({
            programTrackedEntityAttributes: [
                link(
                    'a',
                    {},
                    {
                        displayFormName: 'Form name',
                        preferredSearchOperator: 'EQ',
                        blockedSearchOperators: ['LIKE', 'SW'],
                        minCharactersToSearch: 3,
                    }
                ),
            ],
        })
        expect(metadata.attributes[0]).toMatchObject({
            label: 'Form name',
            preferredSearchOperator: 'eq',
            blockedSearchOperators: ['like', 'sw'],
            minCharactersToSearch: 3,
        })
    })
    it('falls back to displayName when displayFormName is empty', () => {
        const metadata = program({
            programTrackedEntityAttributes: [
                link('a', {}, { displayFormName: '' }),
                link('b', {}, { displayFormName: '   ' }),
            ],
        })
        expect(metadata.attributes.map(({ label }) => label)).toEqual([
            'Name a',
            'Name b',
        ])
    })
})

describe('tracked entities response', () => {
    const row = {
        trackedEntity: 'te1',
        trackedEntityType: 'tet',
        orgUnit: 'ou',
        attributes: [{ attribute: 'a', value: 5 }],
    }

    it('reads legacy instances and a top-level pager', () => {
        const parsed = TrackedEntitiesResponseSchema.parse({
            instances: [row],
            page: 1,
            pageSize: 10,
            total: 42,
        })
        const { rows, total } = normaliseTrackedEntities(parsed)
        expect(rows).toHaveLength(1)
        expect(rows[0]?.attributes).toEqual([{ attribute: 'a', value: '5' }])
        expect(total).toBe(42)
    })

    it('reads trackedEntities with a nested pager', () => {
        const parsed = TrackedEntitiesResponseSchema.parse({
            trackedEntities: [row],
            pager: { page: 1, pageSize: 10, total: 7 },
        })
        expect(normaliseTrackedEntities(parsed).total).toBe(7)
    })

    it('has no total when the server sends none', () => {
        const parsed = TrackedEntitiesResponseSchema.parse({
            trackedEntities: [],
        })
        expect(normaliseTrackedEntities(parsed)).toEqual({ rows: [] })
    })
})
