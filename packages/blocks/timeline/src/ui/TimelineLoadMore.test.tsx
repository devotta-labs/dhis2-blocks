import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import type { TimelineEntry } from '../core/types'
import { TimelineFeed } from './TimelineFeed'
import { TimelineItem } from './TimelineParts'
import { TimelineLoadMore } from './TimelineLoadMore'
import { actionsOf, entry, Provided, source, stateOf } from './__fixtures__/timelineFixtures'

const first = [
    entry('e1', '2026-10-20T09:00'),
    entry('e2', '2026-10-19T09:00'),
]
const more = [entry('e3', '2026-10-18T09:00'), entry('e4', '2026-10-17T09:00')]

const renderEntry = (item: TimelineEntry<string>) => (
    <TimelineItem entry={item}>{item.id}</TimelineItem>
)

/** Appends `more` when the host's loadMore is called, like useTimelineSources. */
const Host = ({ onLoadMore }: { onLoadMore?: () => void }) => {
    const [entries, setEntries] = useState(first)
    const loaded = entries.length > first.length
    return (
        <Provided
            state={stateOf({
                entries,
                sources: [source('a', loaded ? 'complete' : 'hasMore')],
                hasMore: !loaded,
            })}
            actions={actionsOf({
                loadMore: () => {
                    onLoadMore?.()
                    setEntries([...first, ...more])
                },
            })}
        >
            <TimelineFeed<string>>{renderEntry}</TimelineFeed>
            <TimelineLoadMore />
        </Provided>
    )
}

describe('TimelineLoadMore', () => {
    it('moves focus to the first new entry after more entries arrive', async () => {
        const { container } = await render(<Host />)

        container.querySelector('button')?.click()

        await vi.waitFor(() =>
            expect(document.activeElement?.textContent).toContain('e3')
        )
        expect(document.activeElement?.getAttribute('data-timeline-entry-index')).toBe('2')
    })

    it('is reachable and operable with the keyboard alone', async () => {
        const onLoadMore = vi.fn()
        const { container } = await render(<Host onLoadMore={onLoadMore} />)

        await userEvent.tab()
        const button = container.querySelector('button')
        expect(document.activeElement).toBe(button)
        await userEvent.keyboard('{Enter}')

        expect(onLoadMore).toHaveBeenCalledOnce()
        await vi.waitFor(() =>
            expect(document.activeElement?.textContent).toContain('e3')
        )
    })

    it('reads hasMore and loadMore from context and renders nothing when there is nothing more', async () => {
        const loadMore = vi.fn()
        const withMore = await render(
            <Provided state={stateOf({ hasMore: true })} actions={actionsOf({ loadMore })}>
                <TimelineLoadMore />
            </Provided>
        )
        withMore.container.querySelector('button')?.click()
        expect(loadMore).toHaveBeenCalledOnce()
        await withMore.unmount()

        const without = await render(
            <Provided state={stateOf({ hasMore: false })}>
                <TimelineLoadMore />
            </Provided>
        )
        expect(without.container.textContent).toBe('')
    })

    it('shows Loading more and disables the button while loading', async () => {
        const { container } = await render(
            <Provided state={stateOf({ hasMore: true, loadingMore: true })}>
                <TimelineLoadMore />
            </Provided>
        )

        const button = container.querySelector('button')
        expect(button?.textContent).toBe('Loading more')
        expect(button?.disabled).toBe(true)
    })
})
