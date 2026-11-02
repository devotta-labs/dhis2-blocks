import { describe, expect, it } from 'vitest'
import type { RequestLogEntry } from './network'
import { placeBars } from './RequestWaterfall'

const request = (
    id: number,
    started: number,
    ms?: number
): RequestLogEntry => ({
    id,
    at: '',
    request: { resource: `request${id}` },
    started,
    ms,
    outcome: ms === undefined ? 'pending' : 'ok',
})

describe('placeBars', () => {
    it('spans the first start to the last settle', () => {
        const { span, bars } = placeBars(
            [request(1, 1000, 200), request(2, 1100, 900)],
            5000
        )
        expect(span).toBe(1000)
        expect(bars.map(({ left, width }) => [left, width])).toEqual([
            [0, 20],
            [10, 90],
        ])
    })

    it('grows a pending request up to now', () => {
        const { span, bars } = placeBars(
            [request(1, 1000, 100), request(2, 1000)],
            1400
        )
        expect(span).toBe(400)
        expect(bars[1].width).toBe(100)
    })

    it('keeps a pending request sent after now at zero width', () => {
        const { bars } = placeBars([request(1, 1000)], 900)
        expect(bars[0].width).toBe(0)
    })
})
