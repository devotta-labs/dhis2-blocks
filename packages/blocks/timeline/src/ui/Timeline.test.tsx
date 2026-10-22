import axe from 'axe-core'
import React from 'react'
import { render } from 'vitest-browser-react'
import { staticTimelineSource } from '../core/staticTimelineSource'
import type { TimelineEntry, TimelineGroup } from '../core/types'
import { Timeline } from './Timeline'
import { TimelineFeed } from './TimelineFeed'
import {
    TimelineEmpty,
    TimelineGroupHeading,
    TimelineItem,
    TimelineTime,
} from './TimelineParts'
import { TimelineError, TimelineLoading, TimelineSourceNotices } from './TimelineStates'
import { TimelineLoadMore } from './TimelineLoadMore'
import { useTimelineState } from './TimelineContext'
import { entry, Provided, stateOf } from './__fixtures__/timelineFixtures'

const NOW = new Date(2026, 9, 22, 12, 0)

const ENTRIES = [
    entry('future-visit', '2026-10-25T10:00'),
    entry('late-visit', '2026-10-20T09:30'),
    entry('early-visit', '2026-10-20T08:00'),
    entry('day-only', '2026-10-18', { precision: 'day' }),
]

const renderEntry = (item: TimelineEntry<string>) => (
    <TimelineItem entry={item}>
        <TimelineTime entry={item} />
        <span>{item.data}</span>
    </TimelineItem>
)

const renderTimeline = (entries = ENTRIES, children?: React.ReactNode) =>
    render(
        <Timeline
            sources={[staticTimelineSource('a', 'Visits', entries)]}
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

describe('Timeline', () => {
    it('renders an ordered list of day groups, each a section labelled by its heading', async () => {
        const { container } = await renderTimeline()
        await vi.waitFor(() =>
            expect(container.querySelector('ol')).not.toBeNull()
        )

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
        expect(labels).toEqual([
            'Oct 25, 2026',
            'Oct 20, 2026',
            'Oct 18, 2026',
        ])
        expect(sections[1].querySelectorAll('ol > li')).toHaveLength(2)
    })

    it('renders the now marker as visible text between future and past', async () => {
        const { container } = await renderTimeline()
        await vi.waitFor(() =>
            expect(container.querySelector('ol')).not.toBeNull()
        )

        expect(
            textOrder(container, 'Oct 25, 2026', 'Now', 'Oct 20, 2026')
        ).toBe(true)
    })

    it('renders each time as <time> with the stored value in dateTime and HH:mm text', async () => {
        const { container } = await renderTimeline()
        await vi.waitFor(() =>
            expect(container.querySelector('time')).not.toBeNull()
        )

        const time = container.querySelector('time[datetime="2026-10-20T09:30"]')
        expect(time?.textContent).toBe('09:30')
    })

    it('shows no time text for a day-precision entry', async () => {
        const { container } = await renderTimeline([
            entry('day-only', '2026-10-18T00:00', { precision: 'day' }),
        ])
        await vi.waitFor(() =>
            expect(container.textContent).toContain('day-only')
        )

        expect(container.querySelector('time')).toBeNull()
        expect(container.textContent).not.toContain('00:00')
    })

    it('lets a host lay out groups from useTimelineState without TimelineFeed', async () => {
        const Custom = () => {
            const groups = useTimelineState<string, ReturnType<typeof stateOf>['groups']>(
                (state) => state.groups
            )
            return (
                <div data-testid="custom">
                    {groups.map((group) => (
                        <div key={`${group.phase}:${group.key}`}>
                            <TimelineGroupHeading group={group} />
                            <ul>
                                {group.entries.map((item) => (
                                    <li key={item.id}>{item.id}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )
        }
        const { container } = await renderTimeline(ENTRIES, <Custom />)
        await vi.waitFor(() =>
            expect(container.querySelector('[data-testid=custom] h3')).not.toBeNull()
        )

        expect(container.querySelector('ol')).toBeNull()
        expect(
            [...container.querySelectorAll('h3')].map((h) => h.textContent)
        ).toEqual(['Oct 25, 2026', 'Oct 20, 2026', 'Oct 18, 2026'])
    })

    it('renders every part under a hand-written TimelineProvider with no sources', async () => {
        const { container } = await render(
            <Provided state={stateOf({ entries: ENTRIES, sources: [], hasMore: true })}>
                <TimelineLoading />
                <TimelineError />
                <TimelineSourceNotices />
                <TimelineFeed<string>>{renderEntry}</TimelineFeed>
                <TimelineEmpty />
                <TimelineLoadMore />
            </Provided>
        )

        expect(container.textContent).toContain('late-visit')
        expect(container.textContent).toContain('Now')
        expect(container.querySelector('button')?.textContent).toBe('Load more')
    })

    it('has no axe violations when populated', async () => {
        const { container } = await renderTimeline()
        await vi.waitFor(() =>
            expect(container.querySelector('ol')).not.toBeNull()
        )

        const results = await axe.run(container)
        expect(results.violations).toEqual([])
    })

    it('regroups when the host switches groupBy functions', async () => {
        const sources = [staticTimelineSource('a', 'Visits', ENTRIES)]
        const byMonth = (item: TimelineEntry<string>) => ({
            key: item.at.slice(0, 7),
            label: 'Month',
        })
        const byYear = (item: TimelineEntry<string>) => ({
            key: item.at.slice(0, 4),
            label: 'Year',
        })
        const Labels = () => {
            const groups = useTimelineState<string, TimelineGroup<string>[]>(
                (state) => state.groups
            )
            return <p data-testid="labels">{groups.map((g) => g.label).join()}</p>
        }
        const Host = ({ groupBy }: { groupBy: typeof byMonth }) => (
            <Timeline
                sources={sources}
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
        await vi.waitFor(() => expect(labels(container)).toContain('Month'))

        await rerender(<Host groupBy={byYear} />)

        expect(labels(container)).toBe('Year,Year')
    })

    it('does not regroup when the same memoised groupBy is passed again', async () => {
        const sources = [staticTimelineSource('a', 'Visits', ENTRIES)]
        const byMonth = (item: TimelineEntry<string>) => ({
            key: item.at.slice(0, 7),
            label: 'Month',
        })
        let renders = 0
        const Groups = React.memo(() => {
            const groups = useTimelineState((state) => state.groups)
            renders += 1
            return <p data-testid="groups">{groups.length}</p>
        })
        const Host = () => (
            <Timeline
                sources={sources}
                calendar="gregorian"
                locale="en"
                now={NOW}
                groupBy={byMonth}
            >
                <Groups />
            </Timeline>
        )
        const { rerender, container } = await render(<Host />)
        await vi.waitFor(() =>
            expect(
                container.querySelector('[data-testid=groups]')?.textContent
            ).not.toBe('0')
        )
        const before = renders

        await rerender(<Host />)
        await rerender(<Host />)

        expect(renders).toBe(before)
    })
})
