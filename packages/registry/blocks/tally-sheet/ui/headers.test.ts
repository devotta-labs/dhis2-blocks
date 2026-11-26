import { describe, expect, it } from 'vitest'
import { VACCINATIONS } from '../test/tally.fixture'
import { columnHeaderIds, headerLevels, rowSections, sheetIds } from './headers'

describe('headerLevels', () => {
    it('spans each outer option over the columns under it', () => {
        expect(
            headerLevels(VACCINATIONS).map(({ span, headers }) => [
                span,
                headers.map(({ label }) => label),
            ])
        ).toEqual([
            [2, ['0–11 months', '12–23 months']],
            [1, ['Female', 'Male', 'Female', 'Male']],
        ])
    })

    it('names a column by every heading over it', () => {
        const ids = sheetIds('s')
        expect(columnHeaderIds(headerLevels(VACCINATIONS), ids, 3)).toEqual([
            's-column-0-1',
            's-column-1-3',
        ])
    })
})

describe('rowSections', () => {
    it('draws the rows of a group together, where its first row is', () => {
        expect(
            rowSections([
                { id: 'a', label: 'A', group: 'One' },
                { id: 'b', label: 'B' },
                { id: 'c', label: 'C' },
                { id: 'd', label: 'D', group: 'Two' },
                { id: 'e', label: 'E', group: 'One' },
                { id: 'f', label: 'F' },
            ])
        ).toEqual([
            { group: 'One', rows: [0, 4] },
            { rows: [1, 2] },
            { group: 'Two', rows: [3] },
            { rows: [5] },
        ])
    })
})
