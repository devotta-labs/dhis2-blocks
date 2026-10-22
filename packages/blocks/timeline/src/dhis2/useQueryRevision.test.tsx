import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { useQueryRevision } from './useQueryRevision'

const queryKey = ['timeline', 'revision-test']

/** The query fails while `failures` is above zero, then succeeds. */
const setup = async (failures = 0) => {
    let remaining = failures
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
    const { result } = await renderHook(
        () => {
            useQuery({
                queryKey,
                retry: false,
                staleTime: Infinity,
                queryFn: async () => {
                    if (remaining > 0) {
                        remaining -= 1
                        throw new Error('boom')
                    }
                    return 'ok'
                },
            })
            return useQueryRevision(queryKey)
        },
        { wrapper }
    )
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
    const settledCount = () => {
        const state = queryClient.getQueryState(queryKey)
        return (state?.dataUpdateCount ?? 0) + (state?.errorUpdateCount ?? 0)
    }
    return { result, invalidate, settledCount }
}

describe('useQueryRevision', () => {
    it('is undefined after the first settle succeeds', async () => {
        const { result, settledCount } = await setup()

        await expect.poll(settledCount).toBe(1)

        expect(result.current).toBeUndefined()
    })

    it('is undefined after the first settle fails', async () => {
        const { result, settledCount } = await setup(1)

        await expect.poll(settledCount).toBe(1)

        expect(result.current).toBeUndefined()
    })

    it('becomes a number when an invalidation succeeds after a failed first load', async () => {
        const { result, invalidate, settledCount } = await setup(1)
        await expect.poll(settledCount).toBe(1)

        await invalidate()

        await expect.poll(() => result.current).toBeTypeOf('number')
    })

    it('changes when a successful load is invalidated', async () => {
        const { result, invalidate, settledCount } = await setup()
        await expect.poll(settledCount).toBe(1)

        await invalidate()

        await expect.poll(() => result.current).toBeTypeOf('number')
    })

    it('changes on every invalidation, even when each resolves at once', async () => {
        const { result, invalidate, settledCount } = await setup()
        await expect.poll(settledCount).toBe(1)

        await invalidate()
        await expect.poll(settledCount).toBe(2)
        const first = result.current
        await invalidate()
        await expect.poll(settledCount).toBe(3)

        expect(result.current).not.toBe(first)
    })
})
