import { act } from 'react'
import { expect, test } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { useReported } from './useReported'

test('a reported value coming back is not news, in order and however late; any other value is', async () => {
    const news: boolean[] = []
    const { result, rerender } = await renderHook(
        ({ value }: { value: string | undefined } = { value: 'A' }) => {
            const reported = useReported(value)
            if (reported.isNew) {
                news.push(true)
            }
            return reported
        }
    )
    // Two quick commits; the host gives each back in turn.
    act(() => {
        result.current.report('B')
        result.current.report('C')
    })
    await rerender({ value: 'B' })
    await rerender({ value: 'C' })
    expect(news).toEqual([])

    // The one before, said again, is the host's own value now.
    await rerender({ value: 'B' })
    expect(news).toEqual([true])

    // No value reported, and given back as `undefined`.
    act(() => result.current.report(null))
    await rerender({ value: undefined })
    expect(news).toEqual([true])

    await rerender({ value: 'D' })
    expect(news).toEqual([true, true])
})
