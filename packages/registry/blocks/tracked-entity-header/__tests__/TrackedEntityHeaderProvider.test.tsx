import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useTrackedEntityHeader } from '../hooks'
import { TrackedEntityHeaderProvider } from '../provider/TrackedEntityHeaderProvider'
import {
    CHILD,
    createFakeServer,
    createWrapper,
    Probe,
    RMNCH,
} from './headerTestSupport'

const state = () => page.getByTestId('state')

describe('TrackedEntityHeaderProvider', () => {
    it('one person and one metadata request for any number of consumers', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity="te1"
                    program={RMNCH}
                    client={server.client}
                >
                    <Probe />
                    <Probe />
                    <Probe />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )

        await expect
            .element(state().first())
            .toHaveTextContent('ready te1 WHO RMNCH Tracker 5')
        expect(server.countOf('tracker/trackedEntities')).toBe(1)
        expect(server.countOf('programs')).toBe(1)
        expect(server.requests).toHaveLength(2)
    })

    it("without a program, the person type's metadata is fetched after the person", async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity="te1"
                    client={server.client}
                >
                    <Probe />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )

        await expect.element(state()).toHaveTextContent('ready te1 Person 3')
        expect(server.requests.map(({ resource }) => resource)).toEqual([
            'tracker/trackedEntities',
            'trackedEntityTypes',
        ])
    })

    it('a blank program is no program', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity="te1"
                    program="  "
                    client={server.client}
                >
                    <Probe />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )

        await expect.element(state()).toHaveTextContent('ready te1 Person 3')
        expect(server.requests[0]?.params).not.toHaveProperty('program')
        expect(server.countOf('programs')).toBe(0)
    })

    it('a 403 is restricted', async () => {
        const server = createFakeServer({ forbidden: true })
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity="te1"
                    program={RMNCH}
                    client={server.client}
                >
                    <Probe />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )

        await expect.element(state()).toHaveTextContent('restricted')
    })

    it('another failure is failed, and retry refetches until the server recovers', async () => {
        const server = createFakeServer({ fail: 400 })
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity="te1"
                    program={RMNCH}
                    client={server.client}
                >
                    <Probe />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )

        await expect.element(state()).toHaveTextContent('failed')
        server.recover()
        await page.getByRole('button', { name: 'Retry' }).click()
        await expect
            .element(state())
            .toHaveTextContent('ready te1 WHO RMNCH Tracker 5')
    })

    it.each(['', '   '])(
        '%j as trackedEntity makes no request and stays loading',
        async (id) => {
            const server = createFakeServer()
            const Wrapper = createWrapper()

            await render(
                <Wrapper>
                    <TrackedEntityHeaderProvider
                        trackedEntity={id}
                        program={RMNCH}
                        client={server.client}
                    >
                        <Probe />
                    </TrackedEntityHeaderProvider>
                </Wrapper>
            )

            await expect.element(state()).toHaveTextContent('loading')
            expect(server.requests).toHaveLength(0)
        }
    )

    it('switching trackedEntity shows loading until the new person arrives', async () => {
        const server = createFakeServer({ deferFor: 'te2' })
        const Wrapper = createWrapper()
        const seen: string[] = []
        const ui = (trackedEntity: string) => (
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity={trackedEntity}
                    program={RMNCH}
                    client={server.client}
                >
                    <Probe seen={seen} />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )

        const screen = await render(ui('te1'))
        await expect
            .element(state())
            .toHaveTextContent('ready te1 WHO RMNCH Tracker 5')

        const before = seen.length
        await screen.rerender(ui('te2'))
        await expect.element(state()).toHaveTextContent('loading')
        await expect
            .poll(() => server.countOf('tracker/trackedEntities'))
            .toBe(2)

        // Every render since the switch, not only the last one.
        expect(seen.slice(before).every((value) => value === 'loading')).toBe(
            true
        )

        server.release()
        await expect
            .element(state())
            .toHaveTextContent('ready te2 WHO RMNCH Tracker 5')
        expect(seen.slice(before)).not.toContain(
            'ready te1 WHO RMNCH Tracker 5'
        )
    })

    it("switching program for the same person shows loading, never the old program's values", async () => {
        const server = createFakeServer({ deferFor: CHILD })
        const Wrapper = createWrapper()
        const seen: string[] = []
        const ui = (program: string) => (
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity="te1"
                    program={program}
                    client={server.client}
                >
                    <Probe seen={seen} />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )

        const screen = await render(ui(RMNCH))
        await expect
            .element(state())
            .toHaveTextContent('ready te1 WHO RMNCH Tracker 5')

        const before = seen.length
        await screen.rerender(ui(CHILD))
        await expect.element(state()).toHaveTextContent('loading')
        await expect
            .poll(() => server.countOf('tracker/trackedEntities'))
            .toBe(2)

        expect(seen.slice(before).every((value) => value === 'loading')).toBe(
            true
        )

        server.release()
        await expect
            .element(state())
            .toHaveTextContent('ready te1 Child Programme 4')
        expect(seen.slice(before)).not.toContain(
            'ready te1 WHO RMNCH Tracker 5'
        )
    })

    it('the hook throws outside the provider', async () => {
        const Bare = () => {
            useTrackedEntityHeader()
            return null
        }
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        await expect(render(<Bare />)).rejects.toThrow(
            'Tracked entity header parts and hooks must be rendered inside TrackedEntityHeaderProvider'
        )
        error.mockRestore()
    })
})
