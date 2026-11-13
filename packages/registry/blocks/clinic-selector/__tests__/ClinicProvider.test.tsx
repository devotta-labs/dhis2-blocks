import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useEffect, useState, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import type { Clinic } from '../api/schemas'
import { useClinic, type ClinicStatus } from '../hooks'
import {
    ClinicProvider,
    type ClinicProviderProps,
} from '../provider/ClinicProvider'
import { useClinicContext } from '../provider/context'
import { readRemembered, writeRemembered } from '../provider/remembered'
import {
    BRISTOL,
    createServer,
    district,
    facility,
    OCEAN,
    unit,
} from './clinicServerSupport'

/** Lets a test change the host's controlled value. */
interface HostControls {
    setValue: (value: string | undefined) => void
}

interface RenderOptions extends Omit<
    ClinicProviderProps,
    'client' | 'children'
> {
    /** The host makes every pick its controlled value. */
    adopt?: boolean
}

const renderClinic = async (
    server: ReturnType<typeof createServer>,
    { adopt = false, value: initialValue, onValueChange }: RenderOptions = {}
) => {
    // Delays off so the block's own retries finish quickly.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    const seen: ClinicStatus[] = []
    const host: HostControls = {
        setValue: () => {},
    }
    const Host = ({ children }: { children: ReactNode }) => {
        const [value, setValue] = useState(initialValue)
        useEffect(() => {
            host.setValue = setValue
        }, [])
        const change = (clinic: Clinic) => {
            onValueChange?.(clinic)
            if (adopt) {
                setValue(clinic.id)
            }
        }
        return (
            <QueryClientProvider client={queryClient}>
                <ClinicProvider
                    client={server.client}
                    value={value}
                    onValueChange={change}
                >
                    {children}
                </ClinicProvider>
            </QueryClientProvider>
        )
    }
    const rendered = await renderHook(
        () => {
            const hook = useClinic()
            const context = useClinicContext()
            seen.push(hook.status)
            return { hook, context }
        },
        { wrapper: Host }
    )
    return { ...rendered, queryClient, seen, host }
}

type Rendered = Awaited<ReturnType<typeof renderClinic>>

const settled = async ({ result }: Rendered) => {
    await expect.poll(() => result.current.hook.status).not.toBe('pending')
}

const politeRegion = () =>
    document.querySelector('body > [role="status"][aria-live="polite"]')

const names = (clinics: Clinic[]) => clinics.map((c) => c.displayName)

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
})

describe('ClinicProvider', () => {
    it('starts on the first assigned unit by name', async () => {
        const rendered = await renderClinic(createServer())
        await settled(rendered)

        expect(rendered.result.current.hook.status).toBe('ready')
        expect(rendered.result.current.hook.clinic).toEqual(BRISTOL)
    })

    it('starts on the remembered clinic', async () => {
        writeRemembered('u1', { current: OCEAN.id, recent: [] })
        const server = createServer()

        const rendered = await renderClinic(server)
        await settled(rendered)

        expect(rendered.result.current.hook.clinic).toEqual(OCEAN)
        expect(server.byIdRequests()).toHaveLength(0)
    })

    it('reads the key of the user `me` returned', async () => {
        writeRemembered('u1', { current: OCEAN.id, recent: [] })

        const rendered = await renderClinic(createServer({ userId: 'u2' }))
        await settled(rendered)

        expect(rendered.result.current.hook.clinic).toEqual(BRISTOL)
    })

    it('drops a remembered clinic the server does not return', async () => {
        const x = unit('Xclinic', OCEAN.path)
        writeRemembered('u1', { current: x.id, recent: [x.id] })
        const server = createServer({ known: [] })

        const rendered = await renderClinic(server)
        await settled(rendered)

        expect(server.byIdRequests()).toHaveLength(1)
        expect(rendered.result.current.hook.clinic).toEqual(BRISTOL)
        await expect
            .poll(() => readRemembered('u1'))
            .toEqual({ current: undefined, recent: [] })
    })

    it('drops a returned clinic outside the assigned paths', async () => {
        const x = unit('Xclinic', '/Other')
        writeRemembered('u1', { current: x.id, recent: [] })

        const rendered = await renderClinic(createServer({ known: [x] }))
        await settled(rendered)

        expect(rendered.result.current.hook.clinic).toEqual(BRISTOL)
        await expect.poll(() => readRemembered('u1').current).toBeUndefined()
    })

    it('ignores a remembered id that is not a uid', async () => {
        writeRemembered('u1', { current: 'a,b]', recent: [] })
        const server = createServer()

        const rendered = await renderClinic(server)
        await settled(rendered)

        expect(server.byIdRequests()).toHaveLength(0)
        expect(rendered.result.current.hook.clinic).toEqual(BRISTOL)
        await expect.poll(() => readRemembered('u1').current).toBeUndefined()
    })

    it('fails rather than switching when the check fails', async () => {
        const x = unit('Xclinic', OCEAN.path)
        writeRemembered('u1', { current: x.id, recent: [x.id] })
        const server = createServer({ known: [x] })
        server.fail.byId = 500

        const rendered = await renderClinic(server)
        await settled(rendered)

        expect(rendered.result.current.hook.status).toBe('failed')
        expect(rendered.result.current.hook.clinic).toBeUndefined()
        expect(readRemembered('u1')).toEqual({ current: x.id, recent: [x.id] })

        server.fail.byId = undefined
        await rendered.act(() => rendered.result.current.hook.retry())
        await expect
            .poll(() => rendered.result.current.hook.status)
            .toBe('ready')
        expect(rendered.result.current.hook.clinic).toEqual(x)
        expect(readRemembered('u1')).toEqual({ current: x.id, recent: [x.id] })
    })

    it('none when nothing is assigned', async () => {
        const rendered = await renderClinic(createServer({ assigned: [] }))
        await settled(rendered)

        expect(rendered.result.current.hook.status).toBe('none')
        expect(rendered.result.current.hook.clinic).toBeUndefined()
    })

    it('controlled value wins', async () => {
        writeRemembered('u1', { current: BRISTOL.id, recent: [] })

        const rendered = await renderClinic(createServer(), {
            value: OCEAN.id,
        })
        await settled(rendered)

        expect(rendered.result.current.hook.clinic).toEqual(OCEAN)
    })

    it('an invalid controlled value leaves no clinic', async () => {
        const onValueChange = vi.fn()

        const rendered = await renderClinic(createServer({ known: [] }), {
            value: unit('Xclinic').id,
            onValueChange,
        })
        await settled(rendered)

        expect(rendered.result.current.hook.status).toBe('ready')
        expect(rendered.result.current.hook.clinic).toBeUndefined()
        expect(onValueChange).not.toHaveBeenCalled()
    })

    it('a valid controlled value outside assigned becomes a recent', async () => {
        const root = district('Root')
        const x = unit('Xclinic', root.path)

        const rendered = await renderClinic(
            createServer({ assigned: [root], known: [x] }),
            { value: x.id }
        )
        await settled(rendered)

        expect(rendered.result.current.hook.clinic).toEqual(x)
        await expect
            .poll(() => rendered.result.current.context.recent)
            .toEqual([x])
        expect(readRemembered('u1').recent).toEqual([x.id])
    })

    it('setClinic calls onValueChange and remembers', async () => {
        const onValueChange = vi.fn()
        const rendered = await renderClinic(createServer(), { onValueChange })
        await settled(rendered)

        await rendered.act(() => rendered.result.current.hook.setClinic(OCEAN))

        expect(rendered.result.current.hook.clinic).toEqual(OCEAN)
        expect(onValueChange).toHaveBeenCalledWith(OCEAN)
        expect(readRemembered('u1')).toEqual({ current: OCEAN.id, recent: [] })
        await expect
            .poll(() => politeRegion()?.textContent)
            .toBe('Clinic changed to Ocean')
    })

    it('announces a clinic name as written', async () => {
        const named = facility('Smith & Sons <CHC>')
        const rendered = await renderClinic(
            createServer({ assigned: [OCEAN, named] })
        )
        await settled(rendered)

        await rendered.act(() => rendered.result.current.hook.setClinic(named))

        await expect
            .poll(() => politeRegion()?.textContent)
            .toBe('Clinic changed to Smith & Sons <CHC>')
    })

    it('an assigned unit is never a recent', async () => {
        const a = district('A')
        const b = facility('B', a.path)
        const rendered = await renderClinic(createServer({ assigned: [a, b] }))
        await settled(rendered)

        await rendered.act(() => rendered.result.current.hook.setClinic(b))

        expect(rendered.result.current.hook.clinic).toEqual(b)
        expect(rendered.result.current.context.recent).toEqual([])
        expect(rendered.result.current.context.searchable).toBe(true)
    })

    it('a searched clinic becomes a recent, newest first, five kept', async () => {
        const root = district('Root')
        const searched = ['Ca', 'Cb', 'Cc', 'Cd', 'Ce', 'Cf'].map((name) =>
            unit(name, root.path)
        )
        const rendered = await renderClinic(createServer({ assigned: [root] }))
        await settled(rendered)

        for (const clinic of searched) {
            await rendered.act(() =>
                rendered.result.current.hook.setClinic(clinic)
            )
        }

        const newestFive = searched.slice(1).reverse()
        expect(rendered.result.current.hook.clinic).toEqual(searched[5])
        expect(names(rendered.result.current.context.recent)).toEqual(
            names(newestFive)
        )
        expect(readRemembered('u1').recent).toEqual(newestFive.map((c) => c.id))
    })

    it('a blank query makes no request', async () => {
        const server = createServer({ assigned: [district('Root')] })
        const rendered = await renderClinic(server)
        await settled(rendered)
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

        await rendered.act(() =>
            rendered.result.current.context.setQuery('   ')
        )
        await rendered.act(() => vi.advanceTimersByTimeAsync(300))

        expect(server.searchRequests()).toHaveLength(0)
        expect(rendered.result.current.context.search.status).toBe('idle')
    })

    it('searches the server after 250 ms', async () => {
        const root = district('Root')
        const ngelehun = unit('Ngelehun', root.path)
        const server = createServer({ assigned: [root], found: [ngelehun] })
        const rendered = await renderClinic(server)
        await settled(rendered)
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

        await rendered.act(() =>
            rendered.result.current.context.setQuery(' ngel ')
        )
        await rendered.act(() => vi.advanceTimersByTimeAsync(200))
        expect(server.searchRequests()).toHaveLength(0)
        expect(rendered.result.current.context.search.status).toBe('pending')

        await rendered.act(() => vi.advanceTimersByTimeAsync(50))
        expect(server.searchRequests()).toHaveLength(1)
        expect(server.searchRequests()[0]?.params?.query).toBe('ngel')

        // React Query delivers the answer on a timer too.
        await rendered.act(() => vi.advanceTimersByTimeAsync(10))
        expect(rendered.result.current.context.search.status).toBe('ready')
        expect(rendered.result.current.context.search.clinics).toEqual([
            ngelehun,
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
        const rendered = await renderClinic(server)
        await settled(rendered)

        await rendered.act(() => rendered.result.current.context.setQuery('oc'))

        const { context } = rendered.result.current
        expect(context.searchable).toBe(true)
        expect(context.searchesServer).toBe(false)
        expect(context.search.status).toBe('ready')
        expect(names(context.search.clinics)).toEqual(['Docks', 'Ocean'])
        expect(server.searchRequests()).toHaveLength(0)
    })

    it('switches when storage throws', async () => {
        const rendered = await renderClinic(createServer())
        await settled(rendered)
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('full')
        })

        await rendered.act(() => rendered.result.current.hook.setClinic(OCEAN))

        expect(rendered.result.current.hook.clinic).toEqual(OCEAN)
    })
    it('a controlled pick does not re-check', async () => {
        const root = district('Root')
        const [v, r, x] = ['Vclinic', 'Rclinic', 'Xclinic'].map((name) =>
            unit(name, root.path)
        )
        writeRemembered('u1', { current: r.id, recent: [r.id] })
        const server = createServer({ assigned: [root], known: [v, r] })
        const rendered = await renderClinic(server, {
            value: v.id,
            adopt: true,
        })
        await settled(rendered)
        expect(rendered.result.current.hook.clinic).toEqual(v)
        expect(server.byIdRequests()).toHaveLength(1)
        const before = rendered.seen.length

        await rendered.act(() => rendered.result.current.hook.setClinic(x))

        await expect.poll(() => rendered.result.current.hook.clinic).toEqual(x)
        expect(server.byIdRequests()).toHaveLength(1)
        expect(rendered.seen.slice(before)).not.toContain('pending')
        expect(rendered.seen.slice(before)).not.toContain('failed')
    })

    it('re-validates a controlled value that changes after mount', async () => {
        const y = unit('Yclinic', '/Other')
        const server = createServer({ known: [y] })
        const rendered = await renderClinic(server, { value: OCEAN.id })
        await settled(rendered)
        expect(rendered.result.current.hook.clinic).toEqual(OCEAN)
        expect(server.byIdRequests()).toHaveLength(0)

        await rendered.act(() => rendered.host.setValue(y.id))

        await expect.poll(() => server.byIdRequests()).toHaveLength(1)
        expect(server.byIdRequests()[0]?.params?.filter).toBe(`id:in:[${y.id}]`)
        await expect
            .poll(() => rendered.result.current.hook.status)
            .toBe('ready')
        expect(rendered.result.current.hook.clinic).toBeUndefined()
    })

    it("a new user does not inherit the last user's pick", async () => {
        const x = unit('Xclinic', OCEAN.path)
        const harbour = facility('Harbour')
        const server = createServer({ known: [x] })
        const rendered = await renderClinic(server, { adopt: true })
        await settled(rendered)
        await rendered.act(() => rendered.result.current.hook.setClinic(x))
        expect(rendered.result.current.hook.clinic).toEqual(x)

        server.me.userId = 'u2'
        server.me.assigned = [harbour]
        await rendered.act(() => rendered.queryClient.invalidateQueries())

        await expect
            .poll(() => rendered.result.current.context.assigned)
            .toEqual([harbour])
        await expect
            .poll(() => rendered.result.current.hook.status)
            .toBe('ready')
        // The host still holds X, which is not the new user's.
        expect(rendered.result.current.hook.clinic).toBeUndefined()
        expect(rendered.result.current.context.recent).toEqual([])
        expect(
            localStorage.getItem('dhis2-blocks:clinic-selector:u2') ?? ''
        ).not.toContain(x.id)
    })

    it('setClinic ignores a clinic outside the assigned paths', async () => {
        const onValueChange = vi.fn()
        const rendered = await renderClinic(createServer(), { onValueChange })
        await settled(rendered)

        await rendered.act(() =>
            rendered.result.current.hook.setClinic(unit('Xclinic', '/Other'))
        )

        expect(rendered.result.current.hook.clinic).toEqual(BRISTOL)
        expect(onValueChange).not.toHaveBeenCalled()
        expect(readRemembered('u1')).toEqual({ recent: [] })
    })

    it('a failed refetch keeps the current clinic', async () => {
        const server = createServer()
        const rendered = await renderClinic(server)
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
        expect(rendered.result.current.hook.clinic).toEqual(BRISTOL)
    })

    it('setClinic before the clinics load does nothing', async () => {
        const onValueChange = vi.fn()
        const server = createServer()
        server.holdMe()
        const rendered = await renderClinic(server, { onValueChange })
        expect(rendered.result.current.hook.status).toBe('pending')

        await rendered.act(() => rendered.result.current.hook.setClinic(OCEAN))
        server.releaseMe()
        await settled(rendered)

        expect(onValueChange).not.toHaveBeenCalled()
        expect(rendered.result.current.hook.clinic).toEqual(BRISTOL)
        expect(readRemembered('u1')).toEqual({ recent: [] })
    })
})
