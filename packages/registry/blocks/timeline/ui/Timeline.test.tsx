import axe from 'axe-core'
import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import type {
    TimelineEntry,
    TimelineNotice,
    TimelineStatus,
} from '../core/types'
import { Timeline } from './Timeline'
import {
    TimelineMetaProvider,
    useTimeline,
    useTimelineMeta,
} from './TimelineContext'
import { TimelineFeed } from './TimelineFeed'
import {
    TimelineGroupHeading,
    TimelineItem,
    TimelineTime,
} from './TimelineParts'
import { TimelineShowMore, useShowMore } from './TimelineShowMore'
import {
    TimelineEmpty,
    TimelineError,
    TimelineLoading,
    TimelineNotices,
} from './TimelineStates'

const NOW = new Date(2026, 9, 22, 12, 0)

const entry = (
    id: string,
    at: string,
    extra: Partial<TimelineEntry<string>> = {}
): TimelineEntry<string> => ({ id, at, data: id, ...extra })

const ENTRIES = [
    entry('future-visit', '2026-10-25T10:00'),
    entry('late-visit', '2026-10-20T09:30'),
    entry('early-visit', '2026-10-20T08:00'),
    entry('day-only', '2026-10-18', { precision: 'day' }),
]

const renderEntry = (item: TimelineEntry<string>) => (
    <>
        <TimelineTime entry={item} />
        <span>{item.data}</span>
    </>
)

const renderTimeline = (
    entries = ENTRIES,
    children?: React.ReactNode,
    status?: TimelineStatus
) =>
    render(
        <Timeline
            entries={entries}
            status={status}
            calendar="gregorian"
            locale="en"
            now={NOW}
        >
            {children ?? <TimelineFeed<string>>{renderEntry}</TimelineFeed>}
        </Timeline>
    )

const textOrder = (container: HTMLElement, ...texts: string[]) => {
    const nodes = texts.map((text) => {
        const found = [...container.querySelectorAll('*')].find(
            (node) =>
                node.children.length === 0 && node.textContent?.trim() === text
        )
        if (found === undefined) {
            throw new Error(`no element with text "${text}"`)
        }
        return found
    })
    return nodes.every(
        (node, i) =>
            i === 0 ||
            nodes[i - 1].compareDocumentPosition(node) &
                Node.DOCUMENT_POSITION_FOLLOWING
    )
}

const AllStates = ({ onRetry }: { onRetry?: () => void }) => (
    <>
        <TimelineLoading />
        <TimelineError onRetry={onRetry} />
        <TimelineEmpty />
    </>
)

describe('Timeline', () => {
    it('renders an ordered list of day groups, each a section labelled by its heading', async () => {
        const { container } = await renderTimeline()

        const sections = [
            ...container.querySelectorAll('ol > li > section[aria-labelledby]'),
        ]
        const labels = sections.map((section) => {
            const heading = container.querySelector(
                `[id="${section.getAttribute('aria-labelledby')}"]`
            )
            expect(heading?.tagName).toBe('H3')
            return heading?.textContent
        })
        expect(labels).toEqual(['Oct 25, 2026', 'Oct 20, 2026', 'Oct 18, 2026'])
        expect(sections[1].querySelectorAll('ol > li')).toHaveLength(2)
    })

    it('labels a section whose groupBy key has spaces', async () => {
        const { container } = await render(
            <Timeline
                entries={ENTRIES}
                groupBy={() => ({ key: 'Child health', label: 'Child health' })}
                calendar="gregorian"
                now={NOW}
            >
                <TimelineFeed<string>>{renderEntry}</TimelineFeed>
            </Timeline>
        )

        const section = container.querySelector('section[aria-labelledby]')
        const ids = section?.getAttribute('aria-labelledby')?.split(' ') ?? []
        expect(ids).toHaveLength(1)
        expect(container.querySelector(`[id="${ids[0]}"]`)?.textContent).toBe(
            'Child health'
        )
    })

    it('wraps every entry in a focusable list item that names its entry', async () => {
        const { container } = await renderTimeline()

        const items = [
            ...container.querySelectorAll('[data-slot=timeline-item]'),
        ]
        expect(
            items.map((item) => item.getAttribute('data-timeline-entry'))
        ).toEqual(['future-visit', 'late-visit', 'early-visit', 'day-only'])
        expect(items.every((item) => item.tagName === 'LI')).toBe(true)
        expect(items[0].getAttribute('tabindex')).toBe('-1')
    })

    it('passes host props through but keeps the attributes a part relies on', async () => {
        const { container } = await render(
            <Timeline entries={ENTRIES} calendar="gregorian" now={NOW}>
                <ol>
                    <TimelineItem
                        entry={ENTRIES[0]}
                        className="custom-item"
                        data-testid="item"
                        data-slot="mine"
                        data-timeline-entry="mine"
                        tabIndex={0}
                    >
                        content
                    </TimelineItem>
                </ol>
            </Timeline>
        )

        const item = container.querySelector('[data-testid=item]')
        expect(item?.className).toContain('custom-item')
        expect(item?.className).toContain('relative')
        expect(item?.getAttribute('data-slot')).toBe('timeline-item')
        expect(item?.getAttribute('data-timeline-entry')).toBe('future-visit')
        expect(item?.getAttribute('tabindex')).toBe('-1')
    })

    it('marks every part with a timeline data-slot', async () => {
        const { container } = await render(
            <Timeline
                entries={ENTRIES}
                status="success"
                calendar="gregorian"
                now={NOW}
            >
                <TimelineNotices
                    notices={[{ id: 'a', tone: 'info', message: 'Capped.' }]}
                />
                <TimelineFeed<string>>{renderEntry}</TimelineFeed>
                <TimelineShowMore hasMore onShowMore={() => undefined} />
            </Timeline>
        )

        const slots = new Set(
            [...container.querySelectorAll('[data-slot^=timeline]')].map(
                (node) => node.getAttribute('data-slot')
            )
        )
        expect([...slots].sort()).toEqual([
            'timeline',
            'timeline-connector',
            'timeline-feed',
            'timeline-group',
            'timeline-group-entries',
            'timeline-group-heading',
            'timeline-item',
            'timeline-marker',
            'timeline-notice',
            'timeline-notices',
            'timeline-now',
            'timeline-show-more',
            'timeline-time',
        ])
    })

    it('renders the now marker as visible text between future and past', async () => {
        const { container } = await renderTimeline()

        expect(
            textOrder(container, 'Oct 25, 2026', 'Now', 'Oct 20, 2026')
        ).toBe(true)
    })

    it('renders each time as <time> with the stored value in dateTime and HH:mm text', async () => {
        const { container } = await renderTimeline()

        const time = container.querySelector(
            'time[datetime="2026-10-20T09:30"]'
        )
        expect(time?.textContent).toBe('09:30')
    })

    it('shows no time text for a day-precision entry', async () => {
        const { container } = await renderTimeline([
            entry('day-only', '2026-10-18T00:00', { precision: 'day' }),
        ])

        expect(container.textContent).toContain('day-only')
        expect(container.querySelector('time')).toBeNull()
    })

    it('takes className and native props on the root and the feed', async () => {
        const { container } = await render(
            <Timeline
                entries={ENTRIES}
                calendar="gregorian"
                now={NOW}
                className="custom-root"
                aria-label="History"
            >
                <TimelineFeed<string> className="custom-feed">
                    {renderEntry}
                </TimelineFeed>
            </Timeline>
        )

        const root = container.querySelector('[data-slot=timeline]')
        expect(root?.className).toContain('custom-root')
        expect(root?.getAttribute('aria-label')).toBe('History')
        expect(
            container.querySelector('[data-slot=timeline-feed]')?.className
        ).toContain('custom-feed')
    })

    it('lets a host lay out groups from useTimeline without TimelineFeed', async () => {
        const Custom = () => {
            const { groups } = useTimeline<string>().state
            return (
                <div data-testid="custom">
                    {groups.map((group) => (
                        <div key={`${group.phase}:${group.key}`}>
                            <TimelineGroupHeading group={group} />
                        </div>
                    ))}
                </div>
            )
        }
        const { container } = await renderTimeline(ENTRIES, <Custom />)

        expect(container.querySelector('ol')).toBeNull()
        expect(
            [...container.querySelectorAll('h3')].map((h) => h.textContent)
        ).toEqual(['Oct 25, 2026', 'Oct 20, 2026', 'Oct 18, 2026'])
    })

    it('has no axe violations when populated', async () => {
        const { container } = await renderTimeline()

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })

    it('regroups when the host switches groupBy functions', async () => {
        const byMonth = (item: TimelineEntry<string>) => ({
            key: item.at.slice(0, 7),
            label: 'Month',
        })
        const byYear = (item: TimelineEntry<string>) => ({
            key: item.at.slice(0, 4),
            label: 'Year',
        })
        const Labels = () => {
            const { groups } = useTimeline<string>().state
            return (
                <p data-testid="labels">{groups.map((g) => g.label).join()}</p>
            )
        }
        const Host = ({ groupBy }: { groupBy: typeof byMonth }) => (
            <Timeline
                entries={ENTRIES}
                calendar="gregorian"
                locale="en"
                now={NOW}
                groupBy={groupBy}
            >
                <Labels />
            </Timeline>
        )
        const labels = (container: HTMLElement) =>
            container.querySelector('[data-testid=labels]')?.textContent
        const { rerender, container } = await render(<Host groupBy={byMonth} />)
        expect(labels(container)).toContain('Month')

        await rerender(<Host groupBy={byYear} />)

        expect(labels(container)).toBe('Year,Year')
    })

    it('does not regroup when the same entries and groupBy are passed again', async () => {
        const seen = new Set<unknown>()
        const Groups = () => {
            seen.add(useTimeline().state.groups)
            return null
        }
        const Host = () => (
            <Timeline entries={ENTRIES} calendar="gregorian" now={NOW}>
                <Groups />
            </Timeline>
        )
        const { rerender } = await render(<Host />)

        await rerender(<Host />)
        await rerender(<Host />)

        expect(seen.size).toBe(1)
    })
})

describe('timeline states', () => {
    it('shows TimelineLoading, and nothing else, while pending', async () => {
        const { container } = await renderTimeline([], <AllStates />, 'pending')

        expect(container.querySelector('[role=status]')?.textContent).toContain(
            'Loading'
        )
        expect(container.textContent).not.toContain('No history yet')
    })

    it('shows TimelineEmpty only on success with no entries', async () => {
        expect(
            (await renderTimeline([], <AllStates />)).container.textContent
        ).toContain('No history yet')

        const { container } = await renderTimeline(ENTRIES, <AllStates />)
        expect(container.textContent).not.toContain('No history yet')
    })

    it('shows TimelineError with a Retry that calls onRetry', async () => {
        const onRetry = vi.fn()
        const { container } = await renderTimeline(
            [],
            <AllStates onRetry={onRetry} />,
            'error'
        )

        expect(container.textContent).toContain("Couldn't load the history")
        expect(container.textContent).not.toContain('No history yet')
        container.querySelector('button')?.click()
        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('lists notices, with Retry only where one is given, and nothing for none', async () => {
        const retry = vi.fn()
        const notices: TimelineNotice[] = [
            { id: 'a', tone: 'error', message: "Events couldn't load.", retry },
            { id: 'b', tone: 'info', message: 'Showing the most recent 500.' },
        ]
        const { container } = await render(
            <TimelineNotices notices={notices} />
        )

        const items = [...container.querySelectorAll('li')]
        expect(items.map((item) => item.textContent)).toEqual([
            "Events couldn't load.Retry",
            'Showing the most recent 500.',
        ])
        items[0].querySelector('button')?.click()
        expect(retry).toHaveBeenCalledTimes(1)

        const empty = await render(<TimelineNotices notices={[]} />)
        expect(empty.container.querySelector('ul')).toBeNull()
    })

    it('leaves failures to TimelineError when the status is error', async () => {
        const notices: TimelineNotice[] = [
            { id: 'a', tone: 'error', message: "Events couldn't load." },
            { id: 'b', tone: 'info', message: 'Capped.' },
        ]
        const { container } = await renderTimeline(
            [],
            <TimelineNotices notices={notices} />,
            'error'
        )

        expect(container.textContent).toBe('Capped.')
    })

    it('has no axe violations in the error and notice states', async () => {
        const { container } = await renderTimeline(
            [],
            <>
                <AllStates onRetry={() => undefined} />
                <TimelineNotices
                    notices={[{ id: 'a', tone: 'warning', message: 'Capped.' }]}
                />
            </>,
            'error'
        )

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })
})

describe('TimelineMetaProvider', () => {
    it('gives parts outside a Timeline the calendar, locale and today', async () => {
        const Meta = () => {
            const { calendar, locale, today } = useTimelineMeta()
            return <p>{[calendar, locale, today].join()}</p>
        }
        const { container } = await render(
            <TimelineMetaProvider calendar="nepali" locale="ne" now={NOW}>
                <Meta />
            </TimelineMetaProvider>
        )

        expect(container.textContent).toBe('nepali,ne,2026-10-22')
    })
})

describe('show more', () => {
    const MANY = Array.from({ length: 5 }, (_, index) =>
        entry(`visit-${index}`, `2026-10-${String(10 + index)}T09:00`)
    )

    const ShowMoreHost = () => {
        const { entries, hasMore, showMore } = useShowMore(MANY, {
            step: 2,
            now: NOW,
        })
        return (
            <Timeline entries={entries} calendar="gregorian" now={NOW}>
                <TimelineFeed<string>>{renderEntry}</TimelineFeed>
                <TimelineShowMore hasMore={hasMore} onShowMore={showMore} />
            </Timeline>
        )
    }

    const shown = (container: HTMLElement) =>
        [...container.querySelectorAll('[data-timeline-entry]')].map((item) =>
            item.getAttribute('data-timeline-entry')
        )

    it('reveals the newest past entries a step at a time and focuses the first new one', async () => {
        const { container } = await render(<ShowMoreHost />)
        expect(shown(container)).toEqual(['visit-4', 'visit-3'])

        container.querySelector('button')?.click()

        await vi.waitFor(() =>
            expect(shown(container)).toEqual([
                'visit-4',
                'visit-3',
                'visit-2',
                'visit-1',
            ])
        )
        await vi.waitFor(() =>
            expect(
                document.activeElement?.getAttribute('data-timeline-entry')
            ).toBe('visit-2')
        )
    })

    it('hides the button once everything is shown', async () => {
        const { container } = await render(<ShowMoreHost />)

        container.querySelector('button')?.click()
        await vi.waitFor(() => expect(shown(container)).toHaveLength(4))
        container.querySelector('button')?.click()

        await vi.waitFor(() => expect(shown(container)).toHaveLength(5))
        expect(container.querySelector('button')).toBeNull()
    })

    it('focuses the first entry of a page the host fetched', async () => {
        const Host = () => {
            const [pages, setPages] = useState(1)
            const [loading, setLoading] = useState(false)
            return (
                <Timeline
                    entries={MANY.slice(5 - pages * 2).reverse()}
                    calendar="gregorian"
                    now={NOW}
                >
                    <TimelineFeed<string>>{renderEntry}</TimelineFeed>
                    <TimelineShowMore
                        hasMore={pages < 2}
                        loading={loading}
                        onShowMore={() => {
                            setLoading(true)
                            setTimeout(() => {
                                setPages(2)
                                setLoading(false)
                            }, 200)
                        }}
                    />
                </Timeline>
            )
        }
        const { container } = await render(<Host />)
        const button = container.querySelector('button')
        button?.focus()

        button?.click()

        // While the page loads, focus stays on the button, not on <body>.
        await vi.waitFor(() =>
            expect(button?.getAttribute('aria-busy')).toBe('true')
        )
        expect(document.activeElement).toBe(button)
        await vi.waitFor(() =>
            expect(
                document.activeElement?.getAttribute('data-timeline-entry')
            ).toBe('visit-2')
        )
    })
})
