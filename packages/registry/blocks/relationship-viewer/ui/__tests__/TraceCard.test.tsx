import React from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { chains } from '../../__tests__/fixtures'
import type { RelationshipNode, RelationshipStatus } from '../../domain/model'
import { TraceCard } from '../TraceCard'
import { graphOf, te } from './harness'

const CASE: RelationshipStatus = { key: 'case', label: 'Case', color: 'red' }
const OVERDUE: RelationshipStatus = {
    key: 'overdue',
    label: 'Overdue',
    color: 'orange',
    attention: true,
}

const nodeOf = async (id = 'A1'): Promise<RelationshipNode> =>
    (await graphOf(chains(), ['A1'])).nodes.get(te(id))!

const card = async (
    node: RelationshipNode,
    props: Partial<Parameters<typeof TraceCard>[0]> = {}
) => {
    const handlers = {
        onSelect: vi.fn(),
        onExpand: vi.fn(),
        onRetry: vi.fn(),
    }
    const screen = await render(
        <svg viewBox="-100 -40 220 80" width={440} height={160}>
            <TraceCard
                node={node}
                label="Fatmata Kamara"
                status={CASE}
                date={new Date(2026, 0, 3)}
                days={2}
                selected={false}
                {...handlers}
                {...props}
            />
        </svg>
    )
    return { screen, ...handlers }
}

const lines = (container: HTMLElement) =>
    [...container.querySelectorAll('text')].map((t) => t.textContent)

describe('TraceCard', () => {
    it('shows name, status, date and days', async () => {
        const { screen } = await card(await nodeOf())
        expect(lines(screen.container)).toEqual([
            'Fatmata Kamara',
            'Case',
            '2026-01-03 · +2 days',
        ])
    })

    it('a card without dates shows neither', async () => {
        const { screen } = await card(await nodeOf(), {
            date: undefined,
            days: undefined,
        })
        expect(lines(screen.container)).toEqual(['Fatmata Kamara', 'Case', ''])
    })

    it('says the day count in words', async () => {
        const same = await card(await nodeOf(), { days: 0 })
        expect(lines(same.screen.container)).toContain('2026-01-03 · Same day')
        const before = await card(await nodeOf(), { days: -1 })
        expect(lines(before.screen.container)).toContain('2026-01-03 · −1 day')
    })

    it('long names are truncated, the tooltip keeps them', async () => {
        const label = 'Abcdefghij Klmnopqrst Uvwxyz'
        const { screen } = await card(await nodeOf(), { label })
        expect(lines(screen.container)).toContain('Abcdefghij Klmnopqrst Uv…')
        expect(screen.container.querySelector('title')?.textContent).toBe(label)
    })

    it('long status labels are truncated to the card', async () => {
        const { screen } = await card(await nodeOf(), {
            status: {
                ...OVERDUE,
                label: 'Marked for follow-up, overdue by a week',
            },
        })
        expect(lines(screen.container)).toContain(
            'Marked for follow-up, overd…'
        )
        expect(lines(screen.container)).toContain('2026-01-03 · +2 days')
    })

    it('seeds carry the seed mark', async () => {
        const seed = await card(await nodeOf('A1'))
        expect(
            seed.screen.container.querySelector('[data-seed-mark]')
        ).not.toBeNull()
        const other = await card(await nodeOf('A2'))
        expect(
            other.screen.container.querySelector('[data-seed-mark]')
        ).toBeNull()
    })

    it('attention cards carry the ring cue', async () => {
        const plain = await card(await nodeOf())
        expect(
            plain.screen.container.querySelector('[data-attention-ring]')
        ).toBeNull()
        const flagged = await card(await nodeOf(), { status: OVERDUE })
        expect(
            flagged.screen.container.querySelector('[data-attention-ring]')
        ).not.toBeNull()
    })

    it('the stub badge expands without selecting', async () => {
        const node = await nodeOf('A2')
        expect(node.stubCount).toBeGreaterThan(0)
        const { screen, onExpand, onSelect } = await card(node)
        await userEvent.click(screen.container.querySelector('[data-stub]')!)
        expect(onExpand).toHaveBeenCalled()
        expect(onSelect).not.toHaveBeenCalled()
    })

    it('a failed card retries on click', async () => {
        const node: RelationshipNode = {
            ...(await nodeOf()),
            state: { status: 'failed', error: new Error('404') },
        }
        const { screen, onRetry, onSelect } = await card(node)
        const failed = screen.container.querySelector('[data-failed]')!
        expect(failed).not.toBeNull()
        await userEvent.click(failed)
        expect(onRetry).toHaveBeenCalled()
        expect(onSelect).not.toHaveBeenCalled()
    })
})
