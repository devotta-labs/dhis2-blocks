import { Button } from '@/components/dhis2/ui/button'
import React, { type ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import {
    TrackedEntityActions,
    TrackedEntityAttribute,
    TrackedEntityBanner,
    TrackedEntityFacts,
    TrackedEntityName,
} from '..'
import { banner, Composed, flags } from './bannerTestSupport'
import { ALLERGIES, CITY, FIRST, LAST, renderParts } from './valuePartsSupport'

describe('TrackedEntityBanner screenshots', () => {
    afterAll(async () => {
        await page.viewport(414, 896)
    })

    const cases: [
        string,
        ReactNode,
        Parameters<typeof renderParts>[1],
        string,
    ][] = [
        ['default', <TrackedEntityBanner key="default" />, {}, 'Linda'],
        [
            'composed',
            <Composed key="composed" />,
            { person: flags(true, true) },
            'Owned by Ngelehun CHC',
        ],
        [
            'inactive',
            <TrackedEntityBanner key="inactive" />,
            { person: flags(true) },
            'Inactive',
        ],
        [
            'restricted',
            <Composed key="restricted" />,
            { status: 'restricted' },
            'WHO RMNCH Tracker',
        ],
    ]

    describe.each([360, 1200])('at %ipx', (width) => {
        it.each(cases)(
            '%s fits the width',
            async (_, children, options, shown) => {
                await page.viewport(width, 600)
                await renderParts(
                    <div className="p-4">{children}</div>,
                    options
                )
                await expect
                    .element(page.getByText(shown, { exact: false }).first())
                    .toBeVisible()

                const section = banner()
                expect(section.scrollWidth).toBeLessThanOrEqual(
                    section.clientWidth
                )
                expect(await page.screenshot({ element: section })).toContain(
                    '.png'
                )
            }
        )
    })
})

describe('TrackedEntityBanner layout', () => {
    afterAll(async () => {
        await page.viewport(414, 896)
    })

    it('puts the facts on line two and the actions at the end of line one', async () => {
        await page.viewport(1200, 600)
        await renderParts(
            <TrackedEntityBanner>
                <TrackedEntityName attributes={[FIRST, LAST]} />
                <TrackedEntityActions>
                    <Button>Record visit</Button>
                </TrackedEntityActions>
                <TrackedEntityFacts>
                    <TrackedEntityAttribute attribute={ALLERGIES} />
                </TrackedEntityFacts>
            </TrackedEntityBanner>
        )
        await expect.element(page.getByText('Penicillin')).toBeVisible()

        const box = (slot: string) =>
            banner()
                .querySelector(`[data-slot="${slot}"]`)
                ?.getBoundingClientRect() ?? new DOMRect()
        const name = box('tracked-entity-name')
        const facts = box('tracked-entity-facts')
        const actions = box('tracked-entity-actions')
        const section = banner().getBoundingClientRect()
        expect(facts.top).toBeGreaterThanOrEqual(name.bottom)
        expect(actions.top).toBeLessThan(name.bottom)
        expect(section.right - actions.right).toBeLessThan(20)
    })

    it('keeps the actions in their own column when line one is full, so they never take a row', async () => {
        await page.viewport(700, 600)
        await renderParts(
            <TrackedEntityBanner>
                <TrackedEntityName attributes={[FIRST, LAST]} />
                <TrackedEntityAttribute attribute={ALLERGIES} />
                <TrackedEntityAttribute attribute={ALLERGIES} label="Again" />
                <TrackedEntityActions>
                    <Button>Record visit</Button>
                </TrackedEntityActions>
                <TrackedEntityFacts>
                    <TrackedEntityAttribute attribute={ALLERGIES} />
                </TrackedEntityFacts>
            </TrackedEntityBanner>
        )
        await expect.element(page.getByText('Record visit')).toBeVisible()

        const section = banner()
        const box = (slot: string) =>
            section
                .querySelector(`[data-slot="${slot}"]`)
                ?.getBoundingClientRect() ?? new DOMRect()
        const actions = box('tracked-entity-actions')
        const facts = box('tracked-entity-facts')
        const lineOne = [
            ...section.querySelectorAll(
                '[data-slot="tracked-entity-banner-content"] > :not([data-slot="tracked-entity-facts"])'
            ),
        ].map((element) => element.getBoundingClientRect())
        // Nothing on line one shares a row with the actions' left edge.
        for (const part of lineOne) {
            expect(part.right).toBeLessThanOrEqual(actions.left)
        }
        // The facts follow line one directly, with no row left for the actions.
        expect(
            facts.top - Math.max(...lineOne.map((part) => part.bottom))
        ).toBeLessThan(12)
        expect(actions.top - section.getBoundingClientRect().top).toBeLessThan(
            20
        )
    })

    it('puts the actions under everything at a narrow width', async () => {
        await page.viewport(360, 600)
        await renderParts(<Composed />)
        await expect.element(page.getByText('Penicillin')).toBeVisible()

        const section = banner()
        const actions =
            section
                .querySelector('[data-slot="tracked-entity-actions"]')
                ?.getBoundingClientRect() ?? new DOMRect()
        const facts =
            section
                .querySelector('[data-slot="tracked-entity-facts"]')
                ?.getBoundingClientRect() ?? new DOMRect()
        expect(actions.top).toBeGreaterThanOrEqual(facts.bottom)
        expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth)
    })

    it('draws a hairline between pairs, but none at the start of a line', async () => {
        await page.viewport(360, 600)
        await renderParts(<Composed />)
        await expect.element(page.getByText('Penicillin')).toBeVisible()

        const row = banner().querySelector<HTMLElement>(
            '[data-slot="tracked-entity-banner-content"]'
        )
        if (!row) throw new Error('No banner content')
        const edge = row.getBoundingClientRect().left
        const parts = [...row.children]
            .filter((child) => !child.classList.contains('sr-only'))
            .map((part) => part.getBoundingClientRect())
        const dividers = [...row.children]
            .filter((child) => !child.classList.contains('sr-only'))
            .map((part) => getComputedStyle(part, '::before'))
        expect(getComputedStyle(row).overflowX).toBe('clip')
        let between = 0
        parts.forEach((part, index) => {
            expect(dividers[index].width).toBe('1px')
            const dividerAt =
                part.left - edge + parseFloat(dividers[index].insetInlineStart)
            // A line's first part draws its divider outside the row, where it is clipped.
            const startsLine =
                index === 0 || part.top >= parts[index - 1].bottom - 1
            if (startsLine) {
                expect(dividerAt).toBeLessThan(0)
            } else {
                expect(dividerAt).toBeGreaterThan(0)
                between += 1
            }
        })
        expect(between).toBeGreaterThan(0)
    })

    it('sets values in medium weight, and Not recorded in regular', async () => {
        await renderParts(
            <TrackedEntityBanner>
                <TrackedEntityName attributes={[FIRST, LAST]} />
                <TrackedEntityAttribute attribute={ALLERGIES} />
                <TrackedEntityAttribute attribute={CITY} />
            </TrackedEntityBanner>
        )
        await expect.element(page.getByText('Not recorded')).toBeVisible()

        const weight = (text: string) =>
            getComputedStyle(page.getByText(text).element()).fontWeight
        expect(weight('Penicillin')).toBe('500')
        expect(weight('Not recorded')).toBe('400')
    })

    it('opens the details below both lines', async () => {
        await renderParts(<Composed />)
        await userEvent.click(page.getByRole('button', { name: 'Details' }))

        await expect.element(page.getByText('Civil status')).toBeVisible()
        const facts = banner().querySelector(
            '[data-slot="tracked-entity-facts"]'
        )
        const list = page.getByText('Civil status').element()
        expect(list.getBoundingClientRect().top).toBeGreaterThan(
            facts?.getBoundingClientRect().bottom ?? Infinity
        )
    })
})
