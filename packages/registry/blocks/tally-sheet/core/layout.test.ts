import { describe, expect, it } from 'vitest'
import { BOY, GIRL, OLDER_GIRL, VACCINATIONS } from '../test/tally.fixture'
import { indexLayout, tallyColumns } from './layout'

describe('a tally layout', () => {
    it('has a column for each combination of options, the last category changing fastest', () => {
        expect(
            tallyColumns(VACCINATIONS).map(({ labels }) => labels.join(' '))
        ).toEqual([
            '0–11 months Female',
            '0–11 months Male',
            '12–23 months Female',
            '12–23 months Male',
        ])
    })

    it('has one column when it has no categories', () => {
        const index = indexLayout({
            rows: [{ id: 'visits', label: 'Visits' }],
            categories: [],
        })
        expect(index.columns).toHaveLength(1)
        expect(index.cellOf('visits', {})).toBe(0)
    })

    it('numbers each cell and finds none for a row or options it does not have', () => {
        const index = indexLayout(VACCINATIONS)
        expect(index.cellOf('bcg', GIRL)).toBe(0)
        expect(index.cellOf('bcg', BOY)).toBe(1)
        expect(index.cellOf('opv0', GIRL)).toBe(4)
        expect(index.cellOf('nothing', GIRL)).toBeUndefined()
        expect(index.cellOf('bcg', { age: 'under1' })).toBeUndefined()
        expect(index.cellOf('bcg', { age: 'under1', sex: 'x' })).toBeUndefined()
    })

    it('closes a row in every column with the listed options', () => {
        const index = indexLayout(VACCINATIONS)
        expect(index.isClosed(index.cellOf('bcg', OLDER_GIRL) ?? -1)).toBe(true)
        expect(index.isClosed(index.cellOf('bcg', GIRL) ?? -1)).toBe(false)
        expect(index.isClosed(index.cellOf('opv1', OLDER_GIRL) ?? -1)).toBe(
            false
        )
    })

    it('keeps option ids with dots apart', () => {
        const index = indexLayout({
            rows: [{ id: 'r.1', label: 'Row' }],
            categories: [
                {
                    id: 'first',
                    label: 'First',
                    options: [
                        { id: 'a.b', label: 'a.b' },
                        { id: 'a', label: 'a' },
                    ],
                },
                {
                    id: 'second',
                    label: 'Second',
                    options: [
                        { id: 'c', label: 'c' },
                        { id: 'b.c', label: 'b.c' },
                    ],
                },
            ],
        })
        expect(index.cellOf('r.1', { first: 'a.b', second: 'c' })).toBe(0)
        expect(index.cellOf('r.1', { first: 'a', second: 'b.c' })).toBe(3)
    })

    it('refuses ids that would send two cells to one place', () => {
        const row = { id: 'r', label: 'Row' }
        expect(() => indexLayout({ rows: [row, row], categories: [] })).toThrow(
            'share the id r'
        )
        expect(() =>
            indexLayout({ rows: [{ id: '', label: '' }], categories: [] })
        ).toThrow('cannot use')
        expect(() =>
            indexLayout({
                rows: [row],
                categories: [
                    {
                        id: 'sex',
                        label: 'Sex',
                        options: [
                            { id: 'f', label: 'F' },
                            { id: 'f', label: 'F' },
                        ],
                    },
                ],
            })
        ).toThrow('share the id f')
    })
})
