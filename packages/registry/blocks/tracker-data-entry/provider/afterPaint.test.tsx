import { afterPaint } from './afterPaint'
afterEach(() => vi.useRealTimers())

test('runs work after the next paint, in the order it was asked for; cancelled work does not run', async () => {
    const ran: string[] = []
    afterPaint(() => ran.push('rules'))
    const cancel = afterPaint(() => ran.push('cancelled'))
    const painted = Promise.withResolvers<void>()
    afterPaint(() => {
        ran.push('outbox')
        painted.resolve()
    })
    cancel()
    await Promise.resolve()
    expect(ran).toEqual([])

    await painted.promise
    expect(ran).toEqual(['rules', 'outbox'])
})

test('when no frame arrives, the fallback runs the work after 100 ms', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const ran: string[] = []
    afterPaint(() => ran.push('rules'))
    vi.advanceTimersByTime(99)
    expect(ran).toEqual([])
    vi.advanceTimersByTime(1)
    expect(ran).toEqual(['rules'])
})
