import { CustomDataProvider } from '@dhis2/app-runtime'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { useStableDataEngine } from './useStableDataEngine'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const setup = () => {
    const answers = { greeting: { text: 'first' } }
    // The custom data provider makes a new engine every render, as the data provider does before app-runtime 3.17.4.
    const Wrapper = ({ children }: { children: ReactNode }) => {
        const data: CustomData = {
            greeting: async () => answers.greeting,
            note: async (type, query) => ({ type, saved: query.data }),
        }
        return <CustomDataProvider data={data}>{children}</CustomDataProvider>
    }
    return { answers, wrapper: Wrapper }
}

test('the engine stays one object while the data provider renders again', async () => {
    const { wrapper } = setup()
    const { result, rerender } = await renderHook(() => useStableDataEngine(), {
        wrapper,
    })
    const first = result.current
    await rerender()
    await rerender()
    expect(result.current).toBe(first)
})

test('a request goes to the engine of the provider’s latest render', async () => {
    const { answers, wrapper } = setup()
    const { result, rerender } = await renderHook(() => useStableDataEngine(), {
        wrapper,
    })
    const engine = result.current
    answers.greeting = { text: 'second' }
    await rerender()
    await expect(
        engine.query({ greeting: { resource: 'greeting' } })
    ).resolves.toEqual({ greeting: { text: 'second' } })
    await expect(
        engine.mutate({ resource: 'note', type: 'create', data: { a: 1 } })
    ).resolves.toEqual({ type: 'create', saved: { a: 1 } })
})
