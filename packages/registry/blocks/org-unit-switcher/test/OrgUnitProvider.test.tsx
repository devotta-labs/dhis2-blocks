import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useEffect, useState, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import type { OrgUnit } from '../api/schemas'
import { useOrgUnit, type OrgUnitStatus } from '../hooks'
import { OrgUnitSwitcher } from '../OrgUnitSwitcher'
import {
    OrgUnitProvider,
    type OrgUnitProviderProps,
} from '../provider/OrgUnitProvider'
import { useOrgUnitContext } from '../provider/context'
import { readRemembered, writeRemembered } from '../provider/remembered'
import { useOrgUnitSearch } from '../search'
import {
    BRISTOL,
    createServer,
    district,
    facility,
    OCEAN,
    unit,
} from './orgUnitServerSupport'

interface HostControls {
    setValue: (value: string | undefined) => void
}

interface RenderOptions extends Omit<
    OrgUnitProviderProps,
    'client' | 'children'
> {
    adopt?: boolean
}

const renderOrgUnit = async (
    server: ReturnType<typeof createServer>,
    { adopt = false, value: initialValue, onValueChange }: RenderOptions = {}
) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    const seen: OrgUnitStatus[] = []
    const host: HostControls = {
        setValue: () => {},
    }
    const Host = ({ children }: { children: ReactNode }) => {
        const [value, setValue] = useState(initialValue)
        useEffect(() => {
            host.setValue = setValue
        }, [])
        const change = (orgUnit: OrgUnit) => {
            onValueChange?.(orgUnit)
            if (adopt) {
                setValue(orgUnit.id)
            }
        }
        return (
            <QueryClientProvider client={queryClient}>
                <OrgUnitProvider
                    client={server.client}
                    value={value}
                    onValueChange={change}
                >
                    {}
                    <OrgUnitSwitcher />
                    {children}
                </OrgUnitProvider>
            </QueryClientProvider>
        )
    }
    const rendered = await renderHook(
        () => {
            const hook = useOrgUnit()
            const orgUnits = useOrgUnitContext()
            const search = useOrgUnitSearch()
            const context = {
                ...orgUnits.state,
                setQuery: search.setQuery,
                searchable: search.searchable,
                searchesServer: search.searchesServer,
                search,
            }
            seen.push(hook.status)
            return { hook, context }
        },
        { wrapper: Host }
    )
    return { ...rendered, queryClient, seen, host }
}

type Rendered = Awaited<ReturnType<typeof renderOrgUnit>>

const settled = async ({ result }: Rendered) => {
    await expect.poll(() => result.current.hook.status).not.toBe('pending')
}

const politeRegion = () =>
    document.querySelector('body > [role="status"][aria-live="polite"]')

const announcerIdle = () => new Promise((resolve) => setTimeout(resolve, 300))

const names = (orgUnits: OrgUnit[]) => orgUnits.map((c) => c.displayName)

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
})

describe('OrgUnitProvider', () => {
    it('starts on the first assigned unit by name', async () => {
        const rendered = await renderOrgUnit(createServer())
        await settled(rendered)

        expect(rendered.result.current.hook.status).toBe('ready')
        expect(rendered.result.current.hook.orgUnit).toEqual(BRISTOL)
    })

    it('starts on the remembered unit', async () => {
        writeRemembered('u1', { current: OCEAN.id, recent: [] })
        const server = createServer()

        const rendered = await renderOrgUnit(server)
        await settled(rendered)

        expect(rendered.result.current.hook.orgUnit).toEqual(OCEAN)
        expect(server.byIdRequests()).toHaveLength(0)
    })

    it('reads the key of the user `me` returned', async () => {
        writeRemembered('u1', { current: OCEAN.id, recent: [] })

        const rendered = await renderOrgUnit(createServer({ userId: 'u2' }))
        await settled(rendered)

        expect(rendered.result.current.hook.orgUnit).toEqual(BRISTOL)
    })

    it('drops a remembered unit the server does not return', async () => {
        const x = unit('Xclinic', OCEAN.path)
        writeRemembered('u1', { current: x.id, recent: [x.id] })
        const server = createServer({ known: [] })

        const rendered = await renderOrgUnit(server)
        await settled(rendered)

        expect(server.byIdRequests()).toHaveLength(1)
        expect(rendered.result.current.hook.orgUnit).toEqual(BRISTOL)
        await expect
            .poll(() => readRemembered('u1'))
            .toEqual({ current: undefined, recent: [] })
    })

    it('drops a returned unit outside the assigned paths', async () => {
        const x = unit('Xclinic', '/Other')
        writeRemembered('u1', { current: x.id, recent: [] })

        const rendered = await renderOrgUnit(createServer({ known: [x] }))
        await settled(rendered)

        expect(rendered.result.current.hook.orgUnit).toEqual(BRISTOL)
        await expect.poll(() => readRemembered('u1').current).toBeUndefined()
    })

    it('ignores a remembered id that is not a uid', async () => {
        writeRemembered('u1', { current: 'a,b]', recent: [] })
        const server = createServer()

        const rendered = await renderOrgUnit(server)
        await settled(rendered)

        expect(server.byIdRequests()).toHaveLength(0)
        expect(rendered.result.current.hook.orgUnit).toEqual(BRISTOL)
        await expect.poll(() => readRemembered('u1').current).toBeUndefined()
    })

    it('asks rather than switching or failing when the check fails', async () => {
        const x = unit('Xclinic', OCEAN.path)
        writeRemembered('u1', { current: x.id, recent: [x.id] })
        const server = createServer({ known: [x] })
        server.fail.byId = 500

        const rendered = await renderOrgUnit(server)
        await settled(rendered)

        expect(rendered.result.current.hook.status).toBe('ready')
        expect(rendered.result.current.hook.orgUnit).toBeUndefined()
        expect(readRemembered('u1')).toEqual({ current: x.id, recent: [x.id] })

        server.fail.byId = undefined
        await rendered.act(() => rendered.result.current.hook.retry())
        await expect.poll(() => rendered.result.current.hook.orgUnit).toEqual(x)
        expect(readRemembered('u1')).toEqual({ current: x.id, recent: [x.id] })
    })

    it('none when nothing is assigned', async () => {
        const rendered = await renderOrgUnit(createServer({ assigned: [] }))
        await settled(rendered)

        expect(rendered.result.current.hook.status).toBe('none')
        expect(rendered.result.current.hook.orgUnit).toBeUndefined()
    })

    it('controlled value wins', async () => {
        writeRemembered('u1', { current: BRISTOL.id, recent: [] })

        const rendered = await renderOrgUnit(createServer(), {
            value: OCEAN.id,
        })
        await settled(rendered)

        expect(rendered.result.current.hook.orgUnit).toEqual(OCEAN)
    })

    it('an invalid controlled value leaves no unit', async () => {
        const onValueChange = vi.fn()

        const rendered = await renderOrgUnit(createServer({ known: [] }), {
            value: unit('Xclinic').id,
            onValueChange,
        })
        await settled(rendered)

        expect(rendered.result.current.hook.status).toBe('ready')
        expect(rendered.result.current.hook.orgUnit).toBeUndefined()
        expect(onValueChange).not.toHaveBeenCalled()
    })

    it('a valid controlled value outside assigned becomes a recent', async () => {
        const root = district('Root')
        const x = unit('Xclinic', root.path)

        const rendered = await renderOrgUnit(
            createServer({ assigned: [root], known: [x] }),
            { value: x.id }
        )
        await settled(rendered)

        expect(rendered.result.current.hook.orgUnit).toEqual(x)
        await expect
            .poll(() => rendered.result.current.context.recent)
            .toEqual([x])
        expect(readRemembered('u1').recent).toEqual([x.id])
    })

    it('setOrgUnit calls onValueChange and remembers', async () => {
        const onValueChange = vi.fn()
        const rendered = await renderOrgUnit(createServer(), { onValueChange })
        await settled(rendered)

        await rendered.act(() => rendered.result.current.hook.setOrgUnit(OCEAN))

        await rendered.act(() => rendered.result.current.hook.setOrgUnit(OCEAN))

        expect(rendered.result.current.hook.orgUnit).toEqual(OCEAN)
        expect(onValueChange).toHaveBeenCalledTimes(1)
        expect(onValueChange).toHaveBeenCalledWith(OCEAN)
        expect(readRemembered('u1')).toEqual({ current: OCEAN.id, recent: [] })
        await expect
            .poll(() => politeRegion()?.textContent)
            .toBe('Organisation unit changed to Ocean')
    })

    it('announces a unit name as written', async () => {
        const named = facility('Smith & Sons <CHC>')
        const rendered = await renderOrgUnit(
            createServer({ assigned: [OCEAN, named] })
        )
        await settled(rendered)

        await rendered.act(() => rendered.result.current.hook.setOrgUnit(named))

        await expect
            .poll(() => politeRegion()?.textContent)
            .toBe('Organisation unit changed to Smith & Sons <CHC>')
    })

    it('an assigned unit is never a recent', async () => {
        const a = district('A')
        const b = facility('B', a.path)
        const rendered = await renderOrgUnit(createServer({ assigned: [a, b] }))
        await settled(rendered)

        await rendered.act(() => rendered.result.current.hook.setOrgUnit(b))

        expect(rendered.result.current.hook.orgUnit).toEqual(b)
        expect(rendered.result.current.context.recent).toEqual([])
        expect(rendered.result.current.context.searchable).toBe(true)
    })

    it('a searched unit becomes a recent, newest first, five kept', async () => {
        const root = district('Root')
        const searched = ['Ca', 'Cb', 'Cc', 'Cd', 'Ce', 'Cf'].map((name) =>
            unit(name, root.path)
        )
        const rendered = await renderOrgUnit(createServer({ assigned: [root] }))
        await settled(rendered)

        for (const orgUnit of searched) {
            await rendered.act(() =>
                rendered.result.current.hook.setOrgUnit(orgUnit)
            )
        }

        const newestFive = searched.slice(1).reverse()
        expect(rendered.result.current.hook.orgUnit).toEqual(searched[5])
        expect(names(rendered.result.current.context.recent)).toEqual(
            names(newestFive)
        )
        expect(readRemembered('u1').recent).toEqual(newestFive.map((c) => c.id))
    })

    it('searches the server after 250 ms', async () => {
        const root = district('Root')
        const ngelehun = unit('Ngelehun', root.path)
        const server = createServer({ assigned: [root], found: [ngelehun] })
        const rendered = await renderOrgUnit(server)
        await settled(rendered)
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const queried = () =>
            server.searchRequests().filter((r) => r.params?.query !== undefined)

        await rendered.act(() =>
            rendered.result.current.context.setQuery(' ngel ')
        )
        await rendered.act(() => vi.advanceTimersByTimeAsync(200))
        expect(queried()).toHaveLength(0)
        expect(rendered.result.current.context.search.status).toBe('pending')

        await rendered.act(() => vi.advanceTimersByTimeAsync(50))
        expect(queried()).toHaveLength(1)
        expect(queried()[0]?.params?.query).toBe('ngel')

        await rendered.act(() => vi.advanceTimersByTimeAsync(10))
        expect(rendered.result.current.context.search.status).toBe('ready')
        expect(rendered.result.current.context.search.orgUnits).toEqual([
            ngelehun,
        ])
    })

    it('drops search results outside the assigned paths', async () => {
        const root = district('Root')
        const inside = unit('Ngelehun', root.path)
        const outside = unit('Ngelehux', '/Other')
        const server = createServer({
            assigned: [root],
            found: [inside, outside],
        })
        const rendered = await renderOrgUnit(server)
        await settled(rendered)

        await rendered.act(() =>
            rendered.result.current.context.setQuery('ngel')
        )

        await expect
            .poll(() => rendered.result.current.context.search.status)
            .toBe('ready')
        expect(rendered.result.current.context.search.orgUnits).toEqual([
            inside,
        ])
    })

    it('filters locally past eight units with no children', async () => {
        const flat = [
            'Ocean',
            'Docks',
            'Bay',
            'Cove',
            'Dale',
            'Fell',
            'Glen',
            'Hill',
            'Isle',
        ].map((name) => facility(name))
        const server = createServer({ assigned: flat })
        const rendered = await renderOrgUnit(server)
        await settled(rendered)

        await rendered.act(() => rendered.result.current.context.setQuery('oc'))

        const { context } = rendered.result.current
        expect(context.searchable).toBe(true)
        expect(context.searchesServer).toBe(false)
        expect(context.search.status).toBe('ready')
        expect(names(context.search.orgUnits)).toEqual(['Docks', 'Ocean'])
        expect(server.searchRequests()).toHaveLength(0)
    })

    it('switches when storage throws', async () => {
        const rendered = await renderOrgUnit(createServer())
        await settled(rendered)
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('full')
        })

        await rendered.act(() => rendered.result.current.hook.setOrgUnit(OCEAN))

        expect(rendered.result.current.hook.orgUnit).toEqual(OCEAN)
    })
    it('a controlled pick does not re-check', async () => {
        const root = district('Root')
        const [v, r, x] = ['Vclinic', 'Rclinic', 'Xclinic'].map((name) =>
            unit(name, root.path)
        )
        writeRemembered('u1', { current: r.id, recent: [r.id] })
        const server = createServer({ assigned: [root], known: [v, r] })
        const rendered = await renderOrgUnit(server, {
            value: v.id,
            adopt: true,
        })
        await settled(rendered)
        expect(rendered.result.current.hook.orgUnit).toEqual(v)
        expect(server.byIdRequests()).toHaveLength(1)
        const before = rendered.seen.length

        await rendered.act(() => rendered.result.current.hook.setOrgUnit(x))

        await expect.poll(() => rendered.result.current.hook.orgUnit).toEqual(x)
        expect(server.byIdRequests()).toHaveLength(1)
        expect(rendered.seen.slice(before)).not.toContain('pending')
        expect(rendered.seen.slice(before)).not.toContain('failed')
    })

    it('a controlled host that ignores a pick sees no change', async () => {
        const root = district('Root')
        const [v, x] = ['Vclinic', 'Xclinic'].map((name) =>
            unit(name, root.path)
        )
        writeRemembered('u1', { current: v.id, recent: [v.id] })
        const onValueChange = vi.fn()
        const server = createServer({ assigned: [root], known: [v] })
        const rendered = await renderOrgUnit(server, {
            value: v.id,
            onValueChange,
        })
        await settled(rendered)
        const before = readRemembered('u1')

        await announcerIdle()
        politeRegion()?.replaceChildren()

        await rendered.act(() => rendered.result.current.hook.setOrgUnit(x))
        await announcerIdle()

        expect(onValueChange).toHaveBeenCalledTimes(1)
        expect(onValueChange).toHaveBeenCalledWith(x)
        expect(rendered.result.current.hook.orgUnit).toEqual(v)
        expect(readRemembered('u1')).toEqual(before)
        expect(before).toEqual({ current: v.id, recent: [v.id] })
        expect(politeRegion()?.textContent ?? '').toBe('')
    })

    it('a controlled host that adopts a pick is remembered and announced', async () => {
        const root = district('Root')
        const [v, x] = ['Vclinic', 'Xclinic'].map((name) =>
            unit(name, root.path)
        )
        const server = createServer({ assigned: [root], known: [v] })
        const rendered = await renderOrgUnit(server, {
            value: v.id,
            adopt: true,
        })
        await settled(rendered)
        const checks = server.byIdRequests().length

        await rendered.act(() => rendered.result.current.hook.setOrgUnit(x))

        await expect.poll(() => rendered.result.current.hook.orgUnit).toEqual(x)
        await expect.poll(() => readRemembered('u1').current).toBe(x.id)
        expect(readRemembered('u1').recent).toEqual([x.id, v.id])
        await expect
            .poll(() => politeRegion()?.textContent)
            .toBe('Organisation unit changed to Xclinic')
        expect(server.byIdRequests()).toHaveLength(checks)
    })

    it('a value the host changes itself is remembered and announced', async () => {
        const harbour = facility('Harbour')
        const server = createServer({ assigned: [OCEAN, harbour] })
        const rendered = await renderOrgUnit(server, { value: OCEAN.id })
        await settled(rendered)
        await expect.poll(() => readRemembered('u1').current).toBe(OCEAN.id)
        await announcerIdle()
        politeRegion()?.replaceChildren()

        await rendered.act(() => rendered.host.setValue(harbour.id))

        await expect.poll(() => readRemembered('u1').current).toBe(harbour.id)
        await expect
            .poll(() => politeRegion()?.textContent)
            .toBe('Organisation unit changed to Harbour')
    })

    it('re-validates a controlled value that changes after mount', async () => {
        const y = unit('Yclinic', '/Other')
        const server = createServer({ known: [y] })
        const rendered = await renderOrgUnit(server, { value: OCEAN.id })
        await settled(rendered)
        expect(rendered.result.current.hook.orgUnit).toEqual(OCEAN)
        expect(server.byIdRequests()).toHaveLength(0)

        await rendered.act(() => rendered.host.setValue(y.id))

        await expect.poll(() => server.byIdRequests()).toHaveLength(1)
        expect(server.byIdRequests()[0]?.params?.filter).toBe(`id:in:[${y.id}]`)
        await expect
            .poll(() => rendered.result.current.hook.status)
            .toBe('ready')
        expect(rendered.result.current.hook.orgUnit).toBeUndefined()
    })

    it("a new user does not inherit the last user's pick", async () => {
        const x = unit('Xclinic', OCEAN.path)
        const harbour = facility('Harbour')
        const server = createServer({ known: [x] })
        const rendered = await renderOrgUnit(server, { adopt: true })
        await settled(rendered)
        await rendered.act(() => rendered.result.current.hook.setOrgUnit(x))
        expect(rendered.result.current.hook.orgUnit).toEqual(x)

        server.me.userId = 'u2'
        server.me.assigned = [harbour]
        await rendered.act(() => rendered.queryClient.invalidateQueries())

        await expect
            .poll(() => rendered.result.current.context.assigned)
            .toEqual([harbour])
        await expect
            .poll(() => rendered.result.current.hook.status)
            .toBe('ready')

        expect(rendered.result.current.hook.orgUnit).toBeUndefined()
        expect(rendered.result.current.context.recent).toEqual([])
        expect(
            localStorage.getItem('dhis2-blocks:org-unit-switcher:u2') ?? ''
        ).not.toContain(x.id)
    })

    it('setOrgUnit ignores a unit outside the assigned paths', async () => {
        const onValueChange = vi.fn()
        const rendered = await renderOrgUnit(createServer(), { onValueChange })
        await settled(rendered)

        await rendered.act(() =>
            rendered.result.current.hook.setOrgUnit(unit('Xclinic', '/Other'))
        )

        expect(rendered.result.current.hook.orgUnit).toEqual(BRISTOL)
        expect(onValueChange).not.toHaveBeenCalled()
        expect(readRemembered('u1')).toEqual({ recent: [] })
    })

    it('a failed refetch keeps the current unit', async () => {
        const server = createServer()
        const rendered = await renderOrgUnit(server)
        await settled(rendered)

        server.fail.me = 500
        await rendered.act(() => rendered.queryClient.invalidateQueries())

        expect(server.meRequests()).toHaveLength(4)
        expect(
            rendered.queryClient
                .getQueryCache()
                .getAll()
                .some((query) => query.state.status === 'error')
        ).toBe(true)
        expect(rendered.result.current.hook.status).toBe('ready')
        expect(rendered.result.current.hook.orgUnit).toEqual(BRISTOL)
    })

    it('setOrgUnit before the units load does nothing', async () => {
        const onValueChange = vi.fn()
        const server = createServer()
        server.holdMe()
        const rendered = await renderOrgUnit(server, { onValueChange })
        expect(rendered.result.current.hook.status).toBe('pending')

        await rendered.act(() => rendered.result.current.hook.setOrgUnit(OCEAN))
        server.releaseMe()
        await settled(rendered)

        expect(onValueChange).not.toHaveBeenCalled()
        expect(rendered.result.current.hook.orgUnit).toEqual(BRISTOL)
        expect(readRemembered('u1')).toEqual({ recent: [] })
    })
})
