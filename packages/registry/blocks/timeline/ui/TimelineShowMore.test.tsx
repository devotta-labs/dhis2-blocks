import React, { act, StrictMode, useState } from 'react'
import { render as renderReact } from 'vitest-browser-react'
import type { TimelineEntry, TimelineOrder } from '../core/types'
import { useShowMore } from '../hooks/useShowMore'
import { Timeline } from './Timeline'
import { TimelineFeed } from './TimelineFeed'
import { TimelineEnd, TimelineShowMore } from './TimelineShowMore'

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

let previousActEnvironment: boolean | undefined
beforeEach(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT
})
afterEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
})

const render = async (ui: React.ReactNode) => {
    const result = await renderReact(ui)
    // vitest-browser-react resets this after render; these tests also commit synchronously with act.
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    return result
}

const NOW = new Date(2026, 9, 22, 12)
const ENTRIES: TimelineEntry<string>[] = Array.from({ length: 6 }, (_, i) => ({
    id: `visit-${i}`,
    at: `2026-10-${10 + i}T09:00`,
    data: `Visit ${i}`,
}))
const INITIAL = ENTRIES.slice(-2)

interface Page {
    entries: TimelineEntry<string>[]
    hasMore: boolean
}

const Frame = ({
    entries = INITIAL,
    hasMore = true,
    loading = false,
    complete = true,
    order = 'desc',
    onShowMore,
}: {
    entries?: TimelineEntry<string>[]
    hasMore?: boolean
    loading?: boolean
    complete?: boolean
    order?: TimelineOrder
    onShowMore: () => void
}) => (
    <Timeline entries={entries} calendar="gregorian" now={NOW} order={order}>
        <TimelineFeed<string>>{(entry) => entry.data}</TimelineFeed>
        <TimelineShowMore
            hasMore={hasMore}
            loading={loading}
            onShowMore={onShowMore}
        />
        <TimelineEnd hasMore={hasMore} complete={complete} />
    </Timeline>
)

const deferredPage = () => {
    let resolve!: (page: Page) => void
    let reject!: (error: Error) => void
    const promise = new Promise<Page>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}

const ServerHost = ({ load }: { load: () => Promise<Page> }) => {
    const [page, setPage] = useState<Page>({ entries: INITIAL, hasMore: true })
    const [loading, setLoading] = useState(false)
    const [failed, setFailed] = useState(false)
    return (
        <>
            {failed ? <p role="alert">Page failed</p> : null}
            <Frame
                {...page}
                loading={loading}
                complete={!failed}
                onShowMore={() => {
                    setLoading(true)
                    setFailed(false)
                    void load().then(
                        (next) => {
                            setPage(next)
                            setLoading(false)
                        },
                        () => {
                            setFailed(true)
                            setLoading(false)
                        }
                    )
                }}
            />
        </>
    )
}

const showButton = (container: HTMLElement) => {
    const button = container.querySelector<HTMLButtonElement>(
        '[data-slot=timeline-show-more]'
    )
    if (!button) throw new Error('No Show More button')
    return button
}
const shown = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-timeline-entry]')].map((item) =>
        item.getAttribute('data-timeline-entry')
    )
const announcement = (container: HTMLElement) =>
    container.querySelector('[role=status]')?.textContent
const focusedEntry = () =>
    document.activeElement?.getAttribute('data-timeline-entry')
const press = (button: HTMLButtonElement) => {
    button.focus()
    act(() => button.click())
}

describe('committed Show More requests', () => {
    it('pages explicitly future/overdue undated entries while keeping dated follow-up work pinned', async () => {
        const candidates: TimelineEntry<string>[] = [
            {
                id: 'undated-future',
                at: '',
                phase: 'future',
                data: 'Unreadable future',
            },
            { id: 'future', at: '2026-10-25', data: 'Scheduled' },
            {
                id: 'overdue',
                at: '2026-09-01',
                phase: 'overdue',
                data: 'Overdue',
            },
            {
                id: 'past',
                at: '2026-10-30',
                phase: 'past',
                data: 'Already happened',
            },
            {
                id: 'undated-overdue',
                at: 'unknown',
                phase: 'overdue',
                data: 'Unreadable overdue',
            },
        ]
        const Host = () => {
            const { entries, hasMore, showMore } = useShowMore(candidates, {
                step: 1,
                now: NOW,
            })
            return (
                <Frame
                    entries={entries}
                    hasMore={hasMore}
                    onShowMore={showMore}
                />
            )
        }
        const { container } = await render(<Host />)
        expect(shown(container)).toEqual(['future', 'overdue', 'past'])

        press(showButton(container))
        expect(shown(container)).toEqual([
            'future',
            'overdue',
            'past',
            'undated-future',
        ])
        expect(focusedEntry()).toBe('undated-future')
        expect(announcement(container)).toBe('1 older entry shown')

        press(showButton(container))
        expect(shown(container)).toEqual([
            'future',
            'overdue',
            'past',
            'undated-future',
            'undated-overdue',
        ])
        expect(focusedEntry()).toBe('undated-overdue')
        expect(
            container.querySelector('[data-slot=timeline-show-more]')
        ).toBeNull()
    })

    it.each(['asc', 'desc'] as const)(
        'focuses the first fresh item in %s reading order, under Strict Mode',
        async (order) => {
            const Host = () => {
                const { entries, hasMore, showMore } = useShowMore(ENTRIES, {
                    step: 2,
                    now: NOW,
                })
                return (
                    <Frame
                        entries={entries}
                        hasMore={hasMore}
                        onShowMore={showMore}
                        order={order}
                    />
                )
            }
            const { container } = await render(
                <StrictMode>
                    <Host />
                </StrictMode>
            )
            const live = container.querySelector('[role=status]')

            press(showButton(container))
            expect(focusedEntry()).toBe(
                order === 'desc' ? 'visit-3' : 'visit-2'
            )
            expect(announcement(container)).toBe('2 older entries shown')

            if (live === null) throw new Error('No live region')
            const observer = new MutationObserver(() => undefined)
            observer.observe(live, {
                childList: true,
                characterData: true,
                subtree: true,
            })
            press(showButton(container))
            expect(observer.takeRecords().length).toBeGreaterThan(0)
            observer.disconnect()
            expect(focusedEntry()).toBe(
                order === 'desc' ? 'visit-1' : 'visit-0'
            )
            expect(announcement(container)).toBe('2 older entries shown')
            expect(container.querySelector('[role=status]')).toBe(live)
            expect(
                container.querySelector('[data-slot=timeline-show-more]')
            ).toBeNull()
            expect(
                container.querySelector('[data-slot=timeline-end]')?.textContent
            ).toBe(order === 'desc' ? 'Start of the record' : undefined)
        }
    )

    it('waits for a controlled page with busy focus and ignores another press while loading', async () => {
        const next = deferredPage()
        const load = vi.fn(() => next.promise)
        const { container } = await render(
            <StrictMode>
                <ServerHost load={load} />
            </StrictMode>
        )
        const button = showButton(container)
        press(button)

        expect(button.getAttribute('aria-busy')).toBe('true')
        expect(document.activeElement).toBe(button)
        expect(announcement(container)).toBe('')
        act(() => button.click())
        expect(load).toHaveBeenCalledTimes(1)
        expect(shown(container)).toEqual(['visit-5', 'visit-4'])

        await act(async () =>
            next.resolve({ entries: ENTRIES.slice(2), hasMore: true })
        )
        expect(shown(container)).toEqual([
            'visit-5',
            'visit-4',
            'visit-3',
            'visit-2',
        ])
        expect(focusedEntry()).toBe('visit-3')
        expect(announcement(container)).toBe('2 older entries shown')
        expect(button.getAttribute('aria-busy')).toBe('false')
    })

    it.each([true, false])(
        'settles an empty page with hasMore=%s and preserves the live region',
        async (hasMore) => {
            const next = deferredPage()
            const { container } = await render(
                <ServerHost load={() => next.promise} />
            )
            const button = showButton(container)
            const live = container.querySelector('[role=status]')
            press(button)
            await act(async () => next.resolve({ entries: INITIAL, hasMore }))

            expect(container.querySelector('[role=status]')).toBe(live)
            expect(announcement(container)).toBe('')
            if (hasMore) {
                expect(document.activeElement).toBe(button)
            } else {
                expect(
                    container.querySelector('[data-slot=timeline-show-more]')
                ).toBeNull()
                expect(focusedEntry()).toBe('visit-4')
            }
        }
    )

    it('settles a failed page without announcing completion, then permits retry', async () => {
        const first = deferredPage()
        const retry = deferredPage()
        const load = vi
            .fn<() => Promise<Page>>()
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(retry.promise)
        const { container } = await render(<ServerHost load={load} />)
        const button = showButton(container)
        press(button)
        await act(async () => first.reject(new Error('Failed page')))

        expect(container.querySelector('[role=alert]')?.textContent).toBe(
            'Page failed'
        )
        expect(document.activeElement).toBe(button)
        expect(announcement(container)).toBe('')
        expect(container.querySelector('[data-slot=timeline-end]')).toBeNull()

        press(button)
        expect(button.getAttribute('aria-busy')).toBe('true')
        expect(load).toHaveBeenCalledTimes(2)
        await act(async () =>
            retry.resolve({ entries: ENTRIES, hasMore: false })
        )
        expect(focusedEntry()).toBe('visit-3')
        expect(announcement(container)).toBe('4 older entries shown')
        expect(container.querySelector('[role=alert]')).toBeNull()
        expect(
            container.querySelector('[data-slot=timeline-end]')?.textContent
        ).toBe('Start of the record')
    })

    it('settles a no-op before an unrelated committed update can steal focus', async () => {
        const onShowMore = vi.fn()
        const Host = () => {
            const [entries, setEntries] = useState(INITIAL)
            return (
                <>
                    <Frame entries={entries} onShowMore={onShowMore} />
                    <button data-refresh onClick={() => setEntries(ENTRIES)}>
                        Refresh
                    </button>
                </>
            )
        }
        const { container } = await render(<Host />)
        const button = showButton(container)
        press(button)
        expect(onShowMore).toHaveBeenCalledTimes(1)
        act(() =>
            container
                .querySelector<HTMLButtonElement>('[data-refresh]')
                ?.click()
        )

        expect(shown(container)).toHaveLength(6)
        expect(document.activeElement).toBe(button)
        expect(announcement(container)).toBe('')
    })

    it('focuses the last item when a local no-op removes the button', async () => {
        const Host = () => {
            const [hasMore, setHasMore] = useState(true)
            return (
                <Frame hasMore={hasMore} onShowMore={() => setHasMore(false)} />
            )
        }
        const { container } = await render(<Host />)
        press(showButton(container))

        expect(
            container.querySelector('[data-slot=timeline-show-more]')
        ).toBeNull()
        expect(focusedEntry()).toBe('visit-4')
        expect(announcement(container)).toBe('')
    })

    it('does not mistake a second timeline with the same entry ids for this request', async () => {
        const next = deferredPage()
        const { container } = await render(
            <>
                <Frame entries={ENTRIES} onShowMore={() => undefined} />
                <ServerHost load={() => next.promise} />
            </>
        )
        const [first, second] = container.querySelectorAll<HTMLElement>(
            '[data-slot=timeline]'
        )
        press(showButton(second))
        await act(async () =>
            next.resolve({ entries: ENTRIES, hasMore: false })
        )

        expect(focusedEntry()).toBe('visit-3')
        expect(second.contains(document.activeElement)).toBe(true)
        expect(announcement(first)).toBe('')
        expect(announcement(second)).toBe('4 older entries shown')
    })
})
