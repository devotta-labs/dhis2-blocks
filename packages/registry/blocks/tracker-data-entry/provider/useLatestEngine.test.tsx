import { CustomDataProvider } from '@dhis2/app-runtime'
import type { ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { useLatestEngine } from './useLatestEngine'

const ME = { me: { resource: 'me' } }

test('one engine for the mount, which asks the latest provider engine', async () => {
    let id = 'first'
    // A new provider engine every render, answering what `id` was then.
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={{ me: { id } }}>
            {children}
        </CustomDataProvider>
    )
    const { result, rerender } = await renderHook(() => useLatestEngine(), {
        wrapper,
    })
    const engine = result.current
    expect(await engine.query(ME)).toEqual({ me: { id: 'first' } })
    id = 'second'
    await rerender()
    expect(result.current).toBe(engine)
    expect(await engine.query(ME)).toEqual({ me: { id: 'second' } })
})
