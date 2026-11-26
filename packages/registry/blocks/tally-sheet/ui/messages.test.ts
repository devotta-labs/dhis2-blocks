import { describe, expect, it } from 'vitest'
import { indexLayout } from '../core/layout'
import { VACCINATIONS } from '../test/tally.fixture'
import { tappedMessage, undoneMessage } from './messages'

describe('what a cell is called', () => {
    it('names the group, the row and each option over the column', () => {
        const index = indexLayout(VACCINATIONS)
        expect(tappedMessage(index, 8, 2)).toBe(
            '6 weeks, OPV 1, 0–11 months, Female: 2'
        )
        expect(undoneMessage(index, [8], [0, 0, 0, 0, 0, 0, 0, 0, 1])).toBe(
            'Undone: 6 weeks, OPV 1, 0–11 months, Female, now 1'
        )
    })

    it('names the row alone on a sheet with no categories', () => {
        const index = indexLayout({
            rows: [{ id: 'dose1', label: 'Dose 1' }],
            categories: [],
        })
        expect(tappedMessage(index, 0, 3)).toBe('Dose 1: 3')
        expect(undoneMessage(index, [0], [2])).toBe('Undone: Dose 1, now 2')
    })
})
