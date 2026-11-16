import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { render } from 'vitest-browser-react'
import { ClinicProvider } from '..'
import { createServer, district, unit } from './clinicServerSupport'

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
                <ClinicProvider client={server.client} />
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
})
