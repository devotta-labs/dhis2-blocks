import { openDhis2TestServer } from '../../../test/dhis2-server.test-utils'
import { Result } from 'better-result'
import { fixture } from '../test/header.fixture'
import {
    createTrackedEntityHeaderResourceClient,
    type DataEngineValue,
} from './client'
import {
    fetchRelationships,
    fetchRelationshipTypes,
    fetchViewAttributes,
} from './relationships'

const engineReturning = async (path: string, response: DataEngineValue) => {
    const requests: URL[] = []
    const { engine } = await openDhis2TestServer((url) => {
        if (url.pathname === path) {
            requests.push(url)
            return Response.json(response)
        }
        return undefined
    })
    return { client: createTrackedEntityHeaderResourceClient(engine), requests }
}

const ok = <T>(result: Result<T, Error>) => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

const te = (
    id: string,
    attributes?: { attribute: string; value: string }[]
) => ({
    trackedEntity: {
        trackedEntity: id,
        trackedEntityType: 'tt1',
        ...(attributes && { attributes }),
    },
})

const link = (id: string, from: DataEngineValue, to: DataEngineValue) => ({
    relationship: id,
    relationshipType: 'rt1',
    from,
    to,
})

describe('fetchRelationships', () => {
    it('reads the case relationships, asking once for every page with the narrowed fields', async () => {
        const { client, requests } = await engineReturning(
            '/api/tracker/relationships',
            fixture('relationships.case.json')
        )

        const records = ok(await fetchRelationships(client, 'DsSlC54GNXy'))

        expect(requests).toHaveLength(1)
        expect(Object.fromEntries(requests[0].searchParams)).toMatchObject({
            trackedEntity: 'DsSlC54GNXy',
            paging: 'false',
            fields: expect.stringContaining('attributes[attribute,value]'),
        })
        expect(records).toHaveLength(2)
        expect(records.map((r) => r.end)).toEqual(['to', 'to'])
        expect(records.map((r) => r.other)).toMatchObject([
            { kind: 'trackedEntity', id: 'k8TU70vWtnP' },
            { kind: 'trackedEntity', id: 'neR4cmMY22o' },
        ])
        const first = records[0]?.other
        expect(
            first?.kind === 'trackedEntity' && first.values.get('aW66s2QSosT')
        ).toBe('qwerty')
    })

    it('reads the focus relationships from the from end', async () => {
        const { client } = await engineReturning(
            '/api/tracker/relationships',
            fixture('relationships.focus.json')
        )

        const records = ok(await fetchRelationships(client, 'neR4cmMY22o'))

        expect(records).toHaveLength(5)
        expect(records.every((r) => r.end === 'from')).toBe(true)
        expect(records.every((r) => r.type === 'Mv8R4MPcNcX')).toBe(true)
    })

    it('reads event and enrollment ends, and marks the rest unreadable', async () => {
        const { client } = await engineReturning('/api/tracker/relationships', {
            relationships: [
                link('r1', te('a', []), { event: { event: 'ev1' } }),
                link('r2', te('a', []), { enrollment: { enrollment: 'en1' } }),
                link('r3', te('a', []), {}),
                link('r4', te('a', []), te('b')),
            ],
        })

        const records = ok(await fetchRelationships(client, 'a'))

        expect(records.map((r) => r.other)).toEqual([
            { kind: 'event', id: 'ev1' },
            { kind: 'enrollment', id: 'en1' },
            { kind: 'unreadable' },
            { kind: 'unreadable' },
        ])
    })

    it('drops one malformed relationship and keeps the rest', async () => {
        const { client } = await engineReturning('/api/tracker/relationships', {
            relationships: [
                { relationship: 'bad' },
                link('r1', te('a', []), te('b', [])),
            ],
        })

        const records = ok(await fetchRelationships(client, 'a'))

        expect(records.map((r) => r.id)).toEqual(['r1'])
    })

    it('gives a self-link as one record from the from end', async () => {
        const { client } = await engineReturning('/api/tracker/relationships', {
            relationships: [link('r1', te('a', []), te('a', []))],
        })

        const records = ok(await fetchRelationships(client, 'a'))

        expect(records).toHaveLength(1)
        expect(records[0]?.end).toBe('from')
    })

    it('keeps a relationship whose own end has no attributes', async () => {
        const { client } = await engineReturning('/api/tracker/relationships', {
            relationships: [link('r1', te('a'), te('b', []))],
        })

        const records = ok(await fetchRelationships(client, 'a'))

        expect(records).toHaveLength(1)
        expect(records[0]).toMatchObject({
            end: 'from',
            other: { kind: 'trackedEntity', id: 'b' },
        })
    })

    it('drops a relationship the tracked entity is no end of', async () => {
        const { client } = await engineReturning('/api/tracker/relationships', {
            relationships: [link('r1', te('x', []), te('y', []))],
        })

        expect(ok(await fetchRelationships(client, 'a'))).toEqual([])
    })
})

describe('fetchRelationshipTypes', () => {
    it('maps the type with its end names and data views', async () => {
        const { client, requests } = await engineReturning(
            '/api/42/relationshipTypes',
            fixture('relationshipTypes.malaria.json')
        )

        const types = ok(
            await fetchRelationshipTypes(client, [
                'm6XJSapEvOa',
                'Mv8R4MPcNcX',
                'mxZDvSZYxlw',
            ])
        )

        expect(requests).toHaveLength(1)
        expect(Object.fromEntries(requests[0].searchParams)).toMatchObject({
            filter: 'id:in:[m6XJSapEvOa,Mv8R4MPcNcX,mxZDvSZYxlw]',
            paging: 'false',
        })
        const focusToCase = types.get('Mv8R4MPcNcX')
        expect(focusToCase).toMatchObject({
            name: 'Focus to Case',
            fromToName: 'Focus to Case',
            bidirectional: false,
        })
        expect(focusToCase).not.toHaveProperty('toFromName')
        expect(focusToCase?.ends.from.view).toEqual([
            'Kv4fmHVAzwX',
            'QRg7SZ6VOAV',
            'coaSpbzZiTB',
        ])
        expect(focusToCase?.ends.to.typeName).toBe('Malaria Entity')
    })
})

describe('fetchViewAttributes', () => {
    it('maps attributes to their label and value type', async () => {
        const { client } = await engineReturning(
            '/api/42/trackedEntityAttributes',
            fixture('trackedEntityAttributes.malaria.json')
        )

        const attributes = ok(
            await fetchViewAttributes(client, ['aW66s2QSosT'])
        )

        expect(attributes.get('aW66s2QSosT')).toEqual({
            id: 'aW66s2QSosT',
            label: 'Last Name',
            valueType: 'TEXT',
            displayInList: false,
            sortOrder: 0,
        })
    })
})
