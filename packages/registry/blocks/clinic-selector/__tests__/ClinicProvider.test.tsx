import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import {
    createClinicClient,
    type DataEngineLike,
    type ResourceRequest,
} from '../api/client'
import type { AssignedClinic, Clinic } from '../api/schemas'
import { useClinic } from '../hooks'
import {
    ClinicProvider,
    type ClinicProviderProps,
} from '../provider/ClinicProvider'
import { useClinicContext } from '../provider/context'
import { readRemembered, writeRemembered } from '../provider/remembered'

/** A unit whose id is its name padded to a uid. */
const unit = (name: string, parent = ''): Clinic => {
    const id = name.padEnd(11, '0')
    return { id, displayName: name, path: `${parent}/${id}` }
}
const district = (name: string): AssignedClinic => ({
    ...unit(name),
    hasChildren: true,
})
const facility = (name: string, parent = ''): AssignedClinic => ({
    ...unit(name, parent),
    hasChildren: false,
})

const OCEAN = facility('Ocean')
const BRISTOL = facility('Bristol')

interface ServerOptions {
    userId?: string
    assigned?: AssignedClinic[]
    /** What the by-id check finds; ids not here come back missing. */
    known?: Clinic[]
    found?: Clinic[]
}

/** Copies, so the engine sees plain response objects. */
const plain = (clinics: Clinic[]) => clinics.map((clinic) => ({ ...clinic }))

const createServer = ({
    userId = 'u1',
    assigned = [OCEAN, BRISTOL],
    known = [],
    found = [],
}: ServerOptions = {}) => {
    const requests: ResourceRequest[] = []
    let byIdFailsWith: number | undefined
    const server = {
        /** Answers by-id checks with this HTTP status, or normally when undefined. */
        failByIdWith: (status: number | undefined) => {
            byIdFailsWith = status
        },
        byIdRequests: () =>
            requests.filter((request) => request.params?.filter !== undefined),
        searchRequests: () =>
            requests.filter((request) => request.params?.query !== undefined),
        client: createClinicClient({
            query: async (query) => {
                const [[key, request]] = Object.entries(query)
                requests.push(request)
                if (request.resource === 'me') {
                    return {
                        [key]: {
                            id: userId,
                            organisationUnits: assigned.map(
                                ({ hasChildren, ...rest }) => ({
                                    ...rest,
                                    children: hasChildren,
                                })
                            ),
                        },
                    }
                }
                const filter = request.params?.filter
                if (filter !== undefined) {
                    if (byIdFailsWith !== undefined) {
                        throw Object.assign(new Error('boom'), {
                            httpStatusCode: byIdFailsWith,
                        })
                    }
                    const ids = String(filter)
                        .slice('id:in:['.length, -1)
                        .split(',')
                    return {
                        [key]: {
                            organisationUnits: plain(
                                known.filter(({ id }) => ids.includes(id))
                            ),
                        },
                    }
                }
                return {
                    [key]: {
                        pager: { total: found.length },
                        organisationUnits: plain(found),
                    },
                }
            },
        } satisfies DataEngineLike),
    }
    return server
}

const renderClinic = (
    server: ReturnType<typeof createServer>,
    props: Omit<ClinicProviderProps, 'client' | 'children'> = {}
) => {
    // Delays off so the block's own retries finish quickly.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    return renderHook(
        () => {
            const hook = useClinic()
            const context = useClinicContext()
            return { hook, context }
        },
        {
            wrapper: ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={queryClient}>
                    <ClinicProvider client={server.client} {...props}>
                        {children}
                    </ClinicProvider>
                </QueryClientProvider>
            ),
        }
    )
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
        server.failByIdWith(500)

        const rendered = await renderClinic(server)
        await settled(rendered)

        expect(rendered.result.current.hook.status).toBe('failed')
        expect(rendered.result.current.hook.clinic).toBeUndefined()
        expect(readRemembered('u1')).toEqual({ current: x.id, recent: [x.id] })

        server.failByIdWith(undefined)
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
})
