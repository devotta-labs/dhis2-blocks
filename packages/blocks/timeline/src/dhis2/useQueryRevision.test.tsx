import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { useQueryRevision } from './useQueryRevision'

const queryKey = ['timeline', 'revision-test']

/** The query fails while `control.failing` is set, then succeeds. */
const setup = async (failing = false) => {
    const control = { failing }
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
                    if (control.failing) {
                        throw new Error('boom')
                    }
                    return 'ok'
                },
            })
            return useQueryRevision(queryKey)
        },
        { wrapper }
    )
    /** Invalidates and waits until the refetch has settled. */
    const refetch = async () => {
        const before = settledCount()
        await queryClient.invalidateQueries({ queryKey: ['timeline'] })
        await expect.poll(settledCount).toBe(before + 1)
    }
    const settledCount = () => {
        const state = queryClient.getQueryState(queryKey)
        return (state?.dataUpdateCount ?? 0) + (state?.errorUpdateCount ?? 0)
    }
    return { result, control, refetch, settledCount, queryClient }
}

describe('useQueryRevision', () => {
    it('is undefined after the first settle succeeds', async () => {
        const { result, settledCount } = await setup()

        await expect.poll(settledCount).toBe(1)

        expect(result.current).toBeUndefined()
    })

    it('is undefined after the first settle fails', async () => {
        const { result, settledCount } = await setup(true)

        await expect.poll(settledCount).toBe(1)

        expect(result.current).toBeUndefined()
    })

    it('does not change while the query keeps failing', async () => {
        const { result, refetch, settledCount } = await setup(true)
        await expect.poll(settledCount).toBe(1)

        await refetch()
        await refetch()
        await refetch()

        expect(result.current).toBeUndefined()
    })

    it('becomes 1 when a refetch succeeds after a failed first load', async () => {
        const { result, control, refetch, settledCount } = await setup(true)
        await expect.poll(settledCount).toBe(1)
        await refetch()
        control.failing = false

        await refetch()

        await expect.poll(() => result.current).toBe(1)
    })

    it('counts each successful invalidation, even when each resolves at once', async () => {
        const { result, refetch, settledCount } = await setup()
        await expect.poll(settledCount).toBe(1)

        await refetch()
        await expect.poll(() => result.current).toBe(1)
        await refetch()
        await expect.poll(() => result.current).toBe(2)
    })

    it('counts setQueryData as an update', async () => {
        const { result, queryClient, settledCount } = await setup()
        await expect.poll(settledCount).toBe(1)

        queryClient.setQueryData(queryKey, 'changed')

        await expect.poll(() => result.current).toBe(1)
    })

    it('ignores a failed refetch after a successful load', async () => {
        const { result, control, refetch, settledCount } = await setup()
        await expect.poll(settledCount).toBe(1)
        await refetch()
        await expect.poll(() => result.current).toBe(1)

        control.failing = true
        await refetch()

        expect(result.current).toBe(1)
    })
})
