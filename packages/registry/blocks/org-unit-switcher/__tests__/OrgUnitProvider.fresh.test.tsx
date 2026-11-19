import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { act, useEffect } from 'react'
import { render } from 'vitest-browser-react'
import { OrgUnitProvider, useOrgUnit } from '..'
import { useOrgUnitSearch } from '../search'
import type { OrgUnit } from '../api/schemas'
import { readRemembered, writeRemembered } from '../provider/remembered'
import {
    BRISTOL,
    createServer,
    district,
    OCEAN,
    unit,
} from './orgUnitServerSupport'

/** Stands for a menu that has been opened. */
const Opened = () => {
    const { browse } = useOrgUnitSearch()
    useEffect(browse, [browse])
    return null
}

describe('OrgUnitProvider freshness', () => {
    beforeEach(() => localStorage.clear())

    it("keeps the user's units and the unit list fresh, so a return to the tab asks for nothing", async () => {
        const root = district('Root')
        const server = createServer({
            assigned: [root],
            all: [unit('Ngelehun', root.path)],
        })
        const queryClient = new QueryClient()
        await render(
            <QueryClientProvider client={queryClient}>
                <OrgUnitProvider client={server.client}>
                    <Opened />
                </OrgUnitProvider>
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

    it('typing in the search box does not re-render a page that reads the unit', async () => {
        const server = createServer({ assigned: [district('Root')] })
        let pageRenders = 0
        let type = (_query: string) => {}
        const Page = () => {
            useOrgUnit()
            pageRenders += 1
            return null
        }
        const Box = () => {
            const { setQuery } = useOrgUnitSearch()
            type = setQuery
            return null
        }
        await render(
            <QueryClientProvider client={new QueryClient()}>
                <OrgUnitProvider client={server.client}>
                    <Page />
                    <Box />
                </OrgUnitProvider>
            </QueryClientProvider>
        )
        await expect.poll(() => server.meRequests()).toHaveLength(1)
        await new Promise((resolve) => setTimeout(resolve, 50))
        const before = pageRenders

        await act(() => type('nge'))

        expect(pageRenders).toBe(before)
    })

    it('checks a remembered unit again on remount, not from the cache', async () => {
        const x = unit('Xclinic', OCEAN.path)
        const known = [x]
        const server = createServer({ known })
        writeRemembered('u1', { current: x.id, recent: [] })
        const queryClient = new QueryClient()
        let orgUnit: OrgUnit | undefined
        const Page = () => {
            const current = useOrgUnit()
            orgUnit = current.orgUnit
            return null
        }
        const mount = () =>
            render(
                <QueryClientProvider client={queryClient}>
                    <OrgUnitProvider client={server.client}>
                        <Page />
                    </OrgUnitProvider>
                </QueryClientProvider>
            )
        const first = await mount()
        await expect.poll(() => orgUnit).toEqual(x)
        await first.unmount()

        // The user loses the unit between visits; the first visit's answer is still cached.
        known.length = 0
        await mount()

        await expect.poll(() => orgUnit).toEqual(BRISTOL)
        expect(readRemembered('u1').current).toBeUndefined()
        expect(server.byIdRequests()).toHaveLength(2)
    })
})
