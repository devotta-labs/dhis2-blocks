import { groupChangelogRows } from './changelog'
import type { ChangeLogRow, TrackerUser } from './schemas'

const user = (
    username: string,
    firstName?: string,
    surname?: string
): TrackerUser => ({
    uid: undefined,
    username,
    firstName,
    surname,
    displayName: undefined,
})

const row = (
    createdAt: string,
    id: string,
    overrides: Partial<Omit<ChangeLogRow, 'change'>> & {
        change?: Partial<ChangeLogRow['change']>
    } = {}
): ChangeLogRow => ({
    createdAt,
    createdBy: user('admin', 'John', 'Traore'),
    type: 'UPDATE',
    ...overrides,
    change: {
        kind: 'attribute',
        id,
        previousValue: 'a',
        currentValue: 'b',
        ...overrides.change,
    },
})

const T1 = '2026-10-22T19:11:41.594'
const T2 = '2026-10-22T19:11:40.386'

describe('groupChangelogRows', () => {
    it('groups rows that share createdAt and user into one change group', () => {
        const groups = groupChangelogRows([
            row(T1, 'x'),
            row(T2, 'a'),
            row(T2, 'b'),
        ])

        expect(groups).toEqual([
            {
                id: `${T1}:admin`,
                createdAt: T1,
                user: { username: 'admin', displayName: 'John Traore' },
                changes: [
                    {
                        field: { kind: 'attribute', id: 'x' },
                        name: 'x',
                        meta: { valueType: 'TEXT' },
                        type: 'UPDATE',
                        previousValue: 'a',
                        currentValue: 'b',
                    },
                ],
            },
            {
                id: `${T2}:admin`,
                createdAt: T2,
                user: { username: 'admin', displayName: 'John Traore' },
                changes: [
                    expect.objectContaining({
                        field: { kind: 'attribute', id: 'a' },
                    }),
                    expect.objectContaining({
                        field: { kind: 'attribute', id: 'b' },
                    }),
                ],
            },
        ])
    })

    it('keeps two users saving in the same millisecond apart', () => {
        const groups = groupChangelogRows([
            row(T1, 'a', { createdBy: user('alice', 'Alice') }),
            row(T1, 'b', { createdBy: user('bob') }),
            // Not adjacent to alice's other row.
            row(T1, 'c', { createdBy: user('alice', 'Alice') }),
        ])

        expect(
            groups.map((g) => [
                g.id,
                g.user.displayName,
                g.changes.map((c) => c.field.id),
            ])
        ).toEqual([
            [`${T1}:alice`, 'Alice', ['a', 'c']],
            [`${T1}:bob`, 'bob', ['b']],
        ])
    })

    it('keys rows by createdAt plus field, so a repeated field update is kept', () => {
        const groups = groupChangelogRows([
            row(T1, 'a', { change: { previousValue: '2', currentValue: '3' } }),
            row(T2, 'a', { change: { previousValue: '1', currentValue: '2' } }),
            // The same row again (another program's changelog): dropped.
            row(T2, 'a', { change: { previousValue: '1', currentValue: '2' } }),
        ])

        expect(groups.map((g) => g.changes.map((c) => c.currentValue))).toEqual(
            [['3'], ['2']]
        )
    })

    it('marks created and deleted values', () => {
        const [group] = groupChangelogRows([
            row(T1, 'a', {
                type: 'CREATE',
                change: { previousValue: undefined, currentValue: '13' },
            }),
            row(T1, 'b', {
                type: 'DELETE',
                change: { previousValue: '12', currentValue: undefined },
            }),
        ])

        expect(group?.changes).toEqual([
            {
                field: { kind: 'attribute', id: 'a' },
                name: 'a',
                meta: { valueType: 'TEXT' },
                type: 'CREATE',
                currentValue: '13',
            },
            {
                field: { kind: 'attribute', id: 'b' },
                name: 'b',
                meta: { valueType: 'TEXT' },
                type: 'DELETE',
                previousValue: '12',
            },
        ])
    })

    it('merges rows from several programs newest first, keeping each shared row once', () => {
        const tb = [row(T1, 'firstName'), row(T2, 'tbOnly')]
        const child = [row(T2, 'childOnly'), row(T1, 'firstName')]

        const groups = groupChangelogRows([...tb, ...child])

        expect(
            groups.map((g) => [g.createdAt, g.changes.map((c) => c.field.id)])
        ).toEqual([
            [T1, ['firstName']],
            [T2, ['tbOnly', 'childOnly']],
        ])
    })

    it('labels each field through resolve, and event fields by name', () => {
        const [group] = groupChangelogRows(
            [
                row(T1, 'w75KJ2mc4zz'),
                row(T1, 'occurredAt', { change: { kind: 'eventField' } }),
                row(T1, 'unknown'),
            ],
            (field) =>
                field.id === 'w75KJ2mc4zz'
                    ? { name: 'First name', meta: { valueType: 'TEXT' } }
                    : undefined
        )

        expect(group?.changes.map((c) => [c.name, c.meta.valueType])).toEqual([
            ['First name', 'TEXT'],
            ['Event date', 'DATE'],
            ['unknown', 'TEXT'],
        ])
    })
})
