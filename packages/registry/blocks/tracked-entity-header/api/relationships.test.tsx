import { renderHook } from 'vitest-browser-react'
import {
    createWrapper,
    serve,
    type HeaderRequest,
    type ResponseBody,
} from '../__tests__/headerTestSupport'
import relationshipTypes from './__fixtures__/relationshipTypes.malaria.json'
import caseLinks from './__fixtures__/relationships.case.json'
import focusLinks from './__fixtures__/relationships.focus.json'
import viewAttributes from './__fixtures__/trackedEntityAttributes.malaria.json'
import {
    useRelationshipLinks,
    useRelationshipTypes,
    useViewAttributes,
} from './relationships'

/** A server that answers every request with `body`. */
const serverReturning = (body: ResponseBody) => {
    const requests: HeaderRequest[] = []
    const data = serve((request) => {
        requests.push(request)
        return body
    })
    return { wrapper: createWrapper(data), requests }
}

/** The relationships the hook loads for `trackedEntity` from a server that answers with `body`. */
const linksFrom = async (body: ResponseBody, trackedEntity: string) => {
    const { wrapper, requests } = serverReturning(body)
    const { result } = await renderHook(
        () => useRelationshipLinks(trackedEntity),
        { wrapper }
    )
    await expect.poll(() => result.current.isSuccess).toBe(true)
    return { records: result.current.data ?? [], requests }
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

const link = (id: string, from: ResponseBody, to: ResponseBody) => ({
    relationship: id,
    relationshipType: 'rt1',
    from,
    to,
})

describe('useRelationshipLinks', () => {
    it('reads the case relationships, asking once for every page with the narrowed fields', async () => {
        const { records, requests } = await linksFrom(caseLinks, 'DsSlC54GNXy')

        expect(requests).toHaveLength(1)
        expect(requests[0]).toMatchObject({
            resource: 'tracker/relationships',
            params: {
                trackedEntity: 'DsSlC54GNXy',
                paging: false,
                fields: expect.stringContaining('attributes[attribute,value]'),
            },
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
        const { records } = await linksFrom(focusLinks, 'neR4cmMY22o')

        expect(records).toHaveLength(5)
        expect(records.every((r) => r.end === 'from')).toBe(true)
        expect(records.every((r) => r.type === 'Mv8R4MPcNcX')).toBe(true)
    })

    it('reads event and enrollment ends, and marks the rest unreadable', async () => {
        const { records } = await linksFrom(
            {
                relationships: [
                    link('r1', te('a', []), { event: { event: 'ev1' } }),
                    link('r2', te('a', []), {
                        enrollment: { enrollment: 'en1' },
                    }),
                    link('r3', te('a', []), {}),
                    link('r4', te('a', []), te('b')),
                ],
            },
            'a'
        )

        expect(records.map((r) => r.other)).toEqual([
            { kind: 'event', id: 'ev1' },
            { kind: 'enrollment', id: 'en1' },
            { kind: 'unreadable' },
            { kind: 'unreadable' },
        ])
    })

    it('drops one malformed relationship and keeps the rest', async () => {
        const { records } = await linksFrom(
            {
                relationships: [
                    { relationship: 'bad' },
                    link('r1', te('a', []), te('b', [])),
                ],
            },
            'a'
        )

        expect(records.map((r) => r.id)).toEqual(['r1'])
    })

    it('gives a self-link as one record from the from end', async () => {
        const { records } = await linksFrom(
            { relationships: [link('r1', te('a', []), te('a', []))] },
            'a'
        )

        expect(records).toHaveLength(1)
        expect(records[0]?.end).toBe('from')
    })

    it('keeps a relationship whose own end has no attributes', async () => {
        const { records } = await linksFrom(
            { relationships: [link('r1', te('a'), te('b', []))] },
            'a'
        )

        expect(records).toHaveLength(1)
        expect(records[0]).toMatchObject({
            end: 'from',
            other: { kind: 'trackedEntity', id: 'b' },
        })
    })

    it('drops a relationship the tracked entity is no end of', async () => {
        const { records, requests } = await linksFrom(
            { relationships: [link('r1', te('x', []), te('y', []))] },
            'a'
        )

        expect(requests).toHaveLength(1)
        expect(records).toEqual([])
    })

    it('asks for nothing without a tracked entity', async () => {
        const { wrapper, requests } = serverReturning(caseLinks)

        const { result } = await renderHook(
            () => useRelationshipLinks(undefined),
            { wrapper }
        )

        expect(result.current.isPending).toBe(true)
        expect(requests).toHaveLength(0)
    })
})

describe('useRelationshipTypes', () => {
    it('maps the type with its end names and data views', async () => {
        const { wrapper, requests } = serverReturning(relationshipTypes)

        const { result } = await renderHook(
            () =>
                useRelationshipTypes([
                    'm6XJSapEvOa',
                    'Mv8R4MPcNcX',
                    'mxZDvSZYxlw',
                ]),
            { wrapper }
        )
        await expect.poll(() => result.current.isSuccess).toBe(true)

        expect(requests[0]).toMatchObject({
            resource: 'relationshipTypes',
            params: {
                filter: 'id:in:[m6XJSapEvOa,Mv8R4MPcNcX,mxZDvSZYxlw]',
                paging: false,
            },
        })
        const focusToCase = result.current.data?.get('Mv8R4MPcNcX')
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

    it('asks for nothing without a type', async () => {
        const { wrapper, requests } = serverReturning(relationshipTypes)

        const { result } = await renderHook(() => useRelationshipTypes([]), {
            wrapper,
        })

        expect(result.current.isPending).toBe(true)
        expect(requests).toHaveLength(0)
    })
})

describe('useViewAttributes', () => {
    it('maps attributes to their label and value type', async () => {
        const { wrapper, requests } = serverReturning(viewAttributes)

        const { result } = await renderHook(
            () => useViewAttributes(['aW66s2QSosT']),
            { wrapper }
        )
        await expect.poll(() => result.current.isSuccess).toBe(true)

        expect(requests[0]).toMatchObject({
            resource: 'trackedEntityAttributes',
            params: { filter: 'id:in:[aW66s2QSosT]', paging: false },
        })
        expect(result.current.data?.get('aW66s2QSosT')).toEqual({
            id: 'aW66s2QSosT',
            label: 'Last Name',
            valueType: 'TEXT',
            displayInList: false,
            sortOrder: 0,
        })
    })
})
