import { focusManager } from '@tanstack/react-query'
import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useRelationships } from '../parts/relationships/useRelationships'
import { TrackedEntityHeaderProvider } from '../provider/TrackedEntityHeaderProvider'
import {
    CASE_RECORD,
    createFakeServer,
    createWrapper,
    RMNCH,
} from './headerTestSupport'

const Part = ({ id }: { id: string }) => {
    const state = useRelationships()
    return (
        <output data-testid={id}>
            {state.kind === 'ready'
                ? `ready ${state.groups.map((g) => `${g.key}=${g.count}`).join(' ')}`
                : state.kind}
        </output>
    )
}

type ServerOptions = Parameters<typeof createFakeServer>[0]

const setup = async (options?: ServerOptions, parts = ['a', 'b']) => {
    const server = createFakeServer(options)
    const Wrapper = createWrapper()
    await render(
        <Wrapper>
            <TrackedEntityHeaderProvider
                trackedEntity={CASE_RECORD}
                program={RMNCH}
                client={server.client}
            >
                {parts.map((id) => (
                    <Part key={id} id={id} />
                ))}
            </TrackedEntityHeaderProvider>
        </Wrapper>
    )
    return server
}

const part = (id = 'a') => page.getByTestId(id)

describe('useRelationships', () => {
    it('two parts share one request of each kind', async () => {
        const server = await setup()
        await expect.element(part('a')).toHaveTextContent(/^ready /)
        await expect.element(part('b')).toHaveTextContent(/^ready /)
        expect(server.countOf('tracker/relationships')).toBe(1)
        expect(server.countOf('relationshipTypes')).toBe(1)
        expect(server.countOf('trackedEntityAttributes')).toBe(1)
    })

    it('asks for no relationships when no part is mounted', async () => {
        const server = await setup(undefined, [])
        await expect
            .poll(() => server.countOf('tracker/trackedEntities'))
            .toBe(1)
        expect(server.countOf('tracker/relationships')).toBe(0)
    })

    it.each([
        ['restricted', { forbidden: true }],
        ['failed', { fail: 500 }],
        ['not-found', { fail: 404 }],
    ] as const)('is hidden for a %s record', async (_name, options) => {
        const server = await setup(options)
        await expect.element(part()).toHaveTextContent('hidden')
        await expect
            .poll(() => server.countOf('tracker/trackedEntities'))
            .toBeGreaterThan(0)
        expect(server.countOf('tracker/relationships')).toBe(0)
    })

    it.each([500, 403] as const)(
        'is unavailable when the relationships request fails with %s',
        async (relationshipsFail) => {
            await setup({ relationshipsFail })
            await expect.element(part()).toHaveTextContent('unavailable')
        }
    )

    it('is ready and empty without links, and asks for no metadata', async () => {
        const server = await setup({ links: 'none' })
        await expect.element(part()).toHaveTextContent(/^ready$/)
        expect(server.countOf('relationshipTypes')).toBe(0)
        expect(server.countOf('trackedEntityAttributes')).toBe(0)
    })

    it('a remount for the same record asks for the types once', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper()
        const tree = (show: boolean) => (
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity={CASE_RECORD}
                    program={RMNCH}
                    client={server.client}
                >
                    {show && <Part id="a" />}
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )
        const screen = await render(tree(true))
        await expect.element(part()).toHaveTextContent(/^ready /)
        await screen.rerender(tree(false))
        await screen.rerender(tree(true))
        await expect.element(part()).toHaveTextContent(/^ready /)
        expect(server.countOf('relationshipTypes')).toBe(1)
    })

    it('is loading while the relationships request is pending', async () => {
        const server = await setup({ deferRelationships: true })
        await expect.element(part()).toHaveTextContent('loading')
        server.release()
        await expect.element(part()).toHaveTextContent(/^ready /)
    })

    it('asks for no attributes when the types name none in their views', async () => {
        const server = await setup({ bareTypes: true })
        await expect.element(part()).toHaveTextContent(/^ready /)
        expect(server.countOf('relationshipTypes')).toBe(1)
        expect(server.countOf('trackedEntityAttributes')).toBe(0)
    })

    it('keeps the groups when a refetch fails', async () => {
        const server = await setup()
        await expect.element(part()).toHaveTextContent(/^ready /)
        const before = server.countOf('tracker/relationships')
        // A 403 is not retried, so its answer lands at once.
        server.failRelationshipsWith(403)
        // A return to the window refetches the stale relationships.
        focusManager.setFocused(false)
        focusManager.setFocused(true)
        await expect
            .poll(() => server.countOf('tracker/relationships'))
            .toBeGreaterThan(before)
        // The failed answer lands a moment after the request.
        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(part().element()).toHaveTextContent(/^ready /)
        focusManager.setFocused(undefined)
    })
})
