import axe from 'axe-core'
import React from 'react'
import { render } from 'vitest-browser-react'
import { actionsOf, entry, Provided, source, stateOf } from './__fixtures__/timelineFixtures'
import {
    TimelineEmpty,
} from './TimelineParts'
import {
    TimelineError,
    TimelineLoading,
    TimelineSourceNotices,
} from './TimelineStates'
import type { TimelineState } from './TimelineContext'

const AllStates = () => (
    <>
        <TimelineLoading />
        <TimelineEmpty />
        <TimelineError />
        <TimelineSourceNotices />
    </>
)

const renderState = (state: TimelineState<string>, retry = vi.fn()) =>
    render(
        <Provided state={state} actions={actionsOf({ retry })}>
            <AllStates />
        </Provided>
    )

const LOADING = stateOf({
    status: 'loading',
    sources: [source('a', 'loading')],
})
const EMPTY = stateOf({
    sources: [source('a', 'complete'), source('b', 'unsupported')],
})
const FAILED = stateOf({
    sources: [
        source('a', 'error', { error: { kind: 'failed', error: new Error('x') } }),
    ],
})

describe('timeline states', () => {
    it('shows TimelineLoading, not TimelineEmpty, while a source loads', async () => {
        const { container } = await renderState(LOADING)

        expect(container.querySelector('[role=status]')?.textContent).toContain('Loading')
        expect(container.textContent).not.toContain('No history yet')
    })

    it('shows TimelineEmpty only when every source is complete or unsupported with no entries', async () => {
        expect((await renderState(EMPTY)).container.textContent).toContain('No history yet')

        for (const state of [
            LOADING,
            FAILED,
            stateOf({ sources: [source('a', 'hasMore')] }),
            stateOf({
                entries: [entry('e1', '2026-10-20T09:00')],
            }),
        ]) {
            const { container, unmount } = await renderState(state)
            expect(container.textContent).not.toContain('No history yet')
            await unmount()
        }
    })

    it('shows TimelineError only when every source failed', async () => {
        expect((await renderState(FAILED)).container.textContent).toContain(
            "Couldn't load the history"
        )

        const some = await renderState(
            stateOf({
                sources: [
                    source('a', 'complete'),
                    source('b', 'error', {
                        error: { kind: 'failed', error: new Error('x') },
                    }),
                ],
            })
        )
        expect(some.container.textContent).not.toContain("Couldn't load the history")
    })

    it('lets the host replace the empty and error text', async () => {
        const { container } = await render(
            <>
                <Provided state={EMPTY}>
                    <TimelineEmpty>Nothing here</TimelineEmpty>
                </Provided>
                <Provided state={FAILED}>
                    <TimelineError>Try later</TimelineError>
                </Provided>
            </>
        )

        expect(container.textContent).toContain('Nothing here')
        expect(container.textContent).toContain('Try later')
        expect(container.textContent).not.toContain('No history yet')
    })

    it('shows a notice with Retry for a failed source and calls actions.retry with its key', async () => {
        const retry = vi.fn()
        const { container } = await renderState(
            stateOf({
                sources: [
                    source('visits', 'error', {
                        label: 'Visits',
                        error: { kind: 'failed', error: new Error('x') },
                    }),
                ],
            }),
            retry
        )

        expect(container.textContent).toContain("Visits couldn't load.")
        const button = [...container.querySelectorAll('button')].find(
            (b) => b.textContent === 'Retry'
        )
        button?.click()
        expect(retry).toHaveBeenCalledExactlyOnceWith('visits')
    })

    it("shows the partial and unsupported notices, and a source's own notice text", async () => {
        const { container } = await renderState(
            stateOf({
                sources: [
                    source('a', 'complete', { label: 'Visits', partial: true }),
                    source('b', 'unsupported', { label: 'Changes' }),
                    source('c', 'complete', {
                        label: 'Notes',
                        notice: 'Showing the last 100 notes.',
                    }),
                ],
            })
        )

        expect(container.textContent).toContain('Some Visits may be hidden by your access.')
        expect(container.textContent).toContain("Changes isn't available on this DHIS2 version.")
        expect(container.textContent).toContain('Showing the last 100 notes.')
        expect(container.querySelector('button')).toBeNull()
    })

    it('renders nothing for states that do not apply', async () => {
        const { container } = await renderState(
            stateOf({ entries: [entry('e1', '2026-10-20T09:00')] })
        )

        expect(container.textContent).toBe('')
    })

    it.each([
        ['loading', LOADING],
        [
            'partial',
            stateOf({ sources: [source('a', 'complete', { partial: true })] }),
        ],
        ['error', FAILED],
        ['empty', EMPTY],
    ])('has no axe violations when %s', async (_name, state) => {
        const { container } = await renderState(state)

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})
