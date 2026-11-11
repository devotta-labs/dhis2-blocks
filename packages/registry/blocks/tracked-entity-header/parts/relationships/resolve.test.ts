import type {
    AttributeMeta,
    LinkedEnd,
    RelationshipRecord,
    RelationshipTypeMeta,
} from '../../api/types'
import { labelFor, resolveRelationships } from './resolve'

const view = ['aW66s2QSosT', 'h5FuguPFF2j', 'flGbXLXCrEo']
const end = (typeName?: string, v: string[] = []) => ({ typeName, view: v })
const meta = (
    id: string,
    extra: Partial<RelationshipTypeMeta> = {}
): RelationshipTypeMeta => ({
    id,
    name: id,
    bidirectional: false,
    ends: {
        from: end('Malaria Entity', view),
        to: end('Malaria Entity', view),
    },
    ...extra,
})
const focus = meta('Mv8R4MPcNcX', {
    name: 'Focus to Case',
    fromToName: 'Focus to Case',
})
const parentChild = meta('pc', {
    name: 'pc',
    fromToName: 'Parent of',
    toFromName: 'Child of',
})
const mutual = meta('mu', {
    name: 'mu',
    fromToName: 'Sibling',
    bidirectional: true,
})

const te = (id: string, values: Record<string, string> = {}): LinkedEnd => ({
    kind: 'trackedEntity',
    id,
    type: 'tt',
    values: new Map(Object.entries(values)),
})
const rec = (
    id: string,
    type: string,
    endName: 'from' | 'to',
    other: LinkedEnd,
    name?: string
): RelationshipRecord => ({ id, type, end: endName, other, name })

const display = { calendar: 'ethiopian' as const }
const resolve = (
    records: RelationshipRecord[],
    types: RelationshipTypeMeta[] = [],
    attributes: AttributeMeta[] = [],
    labels?: Parameters<typeof resolveRelationships>[0]['labels']
) =>
    resolveRelationships({
        records,
        types: new Map(types.map((t) => [t.id, t])),
        attributes: new Map(attributes.map((a) => [a.id, a])),
        display,
        labels,
    })

describe('labelFor', () => {
    it('uses the end names, the type name, then the fallback', () => {
        expect(labelFor(focus, 'to', 'x')).toBe('Focus to Case')
        expect(labelFor(parentChild, 'from', 'x')).toBe('Parent of')
        expect(labelFor(parentChild, 'to', 'x')).toBe('Child of')
        expect(labelFor(mutual, 'both', 'x')).toBe('Sibling')
        expect(labelFor(undefined, 'to', 'Fallback')).toBe('Fallback')
    })

    it('lets overrides win', () => {
        const o = { from: 'Child', to: 'Mother' }
        expect(labelFor(parentChild, 'from', 'x', o)).toBe('Child')
        expect(labelFor(parentChild, 'to', 'x', o)).toBe('Mother')
        expect(labelFor(mutual, 'both', 'x', o)).toBe('Child')
        expect(labelFor(parentChild, 'to', 'x', 'Same')).toBe('Same')
        expect(labelFor(parentChild, 'from', 'x', 'Same')).toBe('Same')
    })
})

describe('resolveRelationships grouping', () => {
    it('splits a one-way type held at both ends into two groups', () => {
        const groups = resolve(
            [rec('1', 'pc', 'from', te('a')), rec('2', 'pc', 'to', te('b'))],
            [parentChild]
        )
        expect(groups.map((g) => [g.key, g.end, g.label, g.count])).toEqual([
            ['pc:from', 'from', 'Parent of', 1],
            ['pc:to', 'to', 'Child of', 1],
        ])
    })

    it('merges a bidirectional type into one group, in first-seen order', () => {
        const groups = resolve(
            [
                rec('1', 'pc', 'from', te('a')),
                rec('2', 'mu', 'from', te('b')),
                rec('3', 'mu', 'to', te('c')),
            ],
            [parentChild, mutual]
        )
        expect(groups.map((g) => [g.key, g.end, g.count])).toEqual([
            ['pc:from', 'from', 1],
            ['mu', 'both', 2],
        ])
    })

    it('keeps all 300 links of one type in one group', () => {
        const records = Array.from({ length: 300 }, (_, i) =>
            rec(`r${i}`, 'pc', 'from', te(`t${i}`))
        )
        const [group, ...rest] = resolve(records, [parentChild])
        expect(rest).toEqual([])
        expect(group?.count).toBe(300)
        expect(group?.links).toHaveLength(300)
    })

    it('counts event and enrollment ends without links', () => {
        const groups = resolve(
            [
                rec('1', 'pc', 'from', { kind: 'event', id: 'e1' }),
                rec('2', 'pc', 'from', { kind: 'event', id: 'e2' }),
                rec('3', 'mu', 'from', { kind: 'enrollment', id: 'n1' }),
            ],
            [parentChild, mutual]
        )
        expect(groups.map((g) => [g.kind, g.count, g.links])).toEqual([
            ['events', 2, []],
            ['enrollments', 1, []],
        ])
    })

    it('gives restricted links for unreadable ends', () => {
        const [group] = resolve(
            [rec('1', 'pc', 'from', { kind: 'unreadable' })],
            [parentChild]
        )
        expect(group?.count).toBe(1)
        expect(group?.links).toEqual([{ restricted: true }])
    })

    it('labels a record of an unknown type by its name', () => {
        const [group] = resolve([
            rec('1', 'zz', 'from', te('a'), 'Index case to cases'),
        ])
        expect(group).toMatchObject({
            key: 'zz:from',
            label: 'Index case to cases',
            count: 1,
        })
    })

    it('applies label overrides by type', () => {
        const [group] = resolve(
            [rec('1', 'pc', 'to', te('a'))],
            [parentChild],
            [],
            {
                pc: { from: 'Child', to: 'Mother' },
            }
        )
        expect(group?.label).toBe('Mother')
    })
})

describe('resolveRelationships names', () => {
    const attrs: AttributeMeta[] = [
        {
            id: 'h5FuguPFF2j',
            label: 'A',
            valueType: 'TEXT',
            displayInList: true,
            sortOrder: 1,
        },
        {
            id: 'flGbXLXCrEo',
            label: 'B',
            valueType: 'TEXT',
            optionSet: {
                options: [{ code: 'NEL233673', displayName: 'Option name' }],
            },
            displayInList: true,
            sortOrder: 2,
        },
        {
            id: 'd1',
            label: 'D',
            valueType: 'DATE',
            displayInList: true,
            sortOrder: 3,
        },
    ]
    const names = (links: ReturnType<typeof resolve>[number]['links']) =>
        links.map((l) => ('name' in l ? l.name : undefined))

    it('lists view values in view order, skipping missing ones', () => {
        const [g] = resolve(
            [
                rec(
                    '1',
                    'pc',
                    'to',
                    te('k', {
                        h5FuguPFF2j: 'audit',
                        aW66s2QSosT: 'qwerty',
                    })
                ),
            ],
            [parentChild]
        )
        expect(names(g?.links ?? [])).toEqual(['qwerty audit'])
    })

    it('shows option names and formats dates', () => {
        const withDate = meta('wd', {
            ends: {
                from: end('T', ['d1']),
                to: end('T', ['flGbXLXCrEo', 'd1']),
            },
        })
        const [g] = resolve(
            [
                rec(
                    '1',
                    'wd',
                    'from',
                    te('k', { flGbXLXCrEo: 'NEL233673', d1: '2024-03-05' })
                ),
            ],
            [withDate],
            attrs
        )
        const name = names(g?.links ?? [])[0]
        expect(name).toContain('Option name')
        expect(name).toBe('Option name 2016-06-26')
    })

    it('falls back to the other end type name, then the type name', () => {
        const [g] = resolve(
            [rec('1', 'pc', 'from', te('k')), rec('2', 'unk', 'from', te('j'))],
            [parentChild]
        )
        expect(names(g?.links ?? [])).toEqual(['Malaria Entity'])
        expect(resolve([rec('1', 'unk', 'from', te('j'))])[0]?.links).toEqual([
            { id: 'j', name: 'j' },
        ])
    })

    it('uses the returned values, in order, when the type has no metadata', () => {
        const [g] = resolve(
            [
                rec(
                    '1',
                    'unk',
                    'from',
                    te('k', { zz: 'second', d1: '2024-03-05' })
                ),
            ],
            [],
            attrs
        )
        expect(names(g?.links ?? [])).toEqual(['second 2016-06-26'])
    })

    it('uses the type name when the other end has no type name or view', () => {
        const bare = meta('bare', {
            name: 'Bare type',
            ends: { from: end(), to: end() },
        })
        const [g] = resolve([rec('1', 'bare', 'from', te('k'))], [bare])
        expect(names(g?.links ?? [])).toEqual(['Bare type'])
    })

    it('counts a self-link once', () => {
        expect(
            resolve([rec('1', 'pc', 'from', te('me'))], [parentChild])[0]?.count
        ).toBe(1)
    })
})
