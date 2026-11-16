import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { act, useEffect } from 'react'
import { render } from 'vitest-browser-react'
import { ClinicProvider, useClinic } from '..'
import { useClinicSearch } from '../provider/context'
import { createServer, district, unit } from './clinicServerSupport'

/** Stands for a menu that has been opened. */
const Opened = () => {
    const { browse } = useClinicSearch()
    useEffect(browse, [browse])
    return null
}

describe('ClinicProvider freshness', () => {
    it("keeps the user's units and the clinic list fresh, so a return to the tab asks for nothing", async () => {
        const root = district('Root')
        const server = createServer({
            assigned: [root],
            all: [unit('Ngelehun', root.path)],
        })
        const queryClient = new QueryClient()
        await render(
            <QueryClientProvider client={queryClient}>
                <ClinicProvider client={server.client}>
                    <Opened />
                </ClinicProvider>
            </QueryClientProvider>
        )
        await expect.poll(() => server.searchRequests()).toHaveLength(1)
        const loaded = () =>
            queryClient
                .getQueryCache()
                .getAll()
                .filter((query) => query.state.status === 'success')
        await expect.poll(() => loaded()).toHaveLength(2)

        expect(loaded().every((query) => !query.isStale())).toBe(true)
    })

    it('typing in the search box does not re-render a page that reads the clinic', async () => {
        const server = createServer({ assigned: [district('Root')] })
        let pageRenders = 0
        let type = (_query: string) => {}
        const Page = () => {
            useClinic()
            pageRenders += 1
            return null
        }
        const Box = () => {
            const { setQuery } = useClinicSearch()
            type = setQuery
            return null
        }
        await render(
            <QueryClientProvider client={new QueryClient()}>
                <ClinicProvider client={server.client}>
                    <Page />
                    <Box />
                </ClinicProvider>
            </QueryClientProvider>
        )
        await expect.poll(() => server.meRequests()).toHaveLength(1)
        await new Promise((resolve) => setTimeout(resolve, 50))
        const before = pageRenders

        await act(() => type('nge'))

        expect(pageRenders).toBe(before)
    })
})
