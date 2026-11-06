import { CustomDataProvider } from '@dhis2/app-runtime'
import type { ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { useProgramRulesClient } from './client'

test('the client stays the same object when the data provider makes a new engine', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={{}}>{children}</CustomDataProvider>
    )
    const { result, rerender } = await renderHook(useProgramRulesClient, {
        wrapper,
    })
    const before = result.current

    await rerender()

    expect(result.current).toBe(before)
})
