import { afterPaint } from './afterPaint'
import { later } from './__tests__/rig'

afterEach(() => vi.restoreAllMocks())

test('runs work after the next paint, in the order it was asked for; cancelled work does not run', async () => {
    const ran: string[] = []
    afterPaint(() => ran.push('rules'))
    const cancel = afterPaint(() => ran.push('cancelled'))
    afterPaint(() => ran.push('outbox'))
    cancel()
    await Promise.resolve()
    expect(ran).toEqual([])

    await new Promise((resolve) => requestAnimationFrame(resolve))
    await later(0)
    expect(ran).toEqual(['rules', 'outbox'])
})

test('a page that paints no frame, as a hidden one, runs the work after 100 ms', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0)
    const ran: string[] = []
    afterPaint(() => ran.push('rules'))
    await later(50)
    expect(ran).toEqual([])
    await later(100)
    expect(ran).toEqual(['rules'])
})
