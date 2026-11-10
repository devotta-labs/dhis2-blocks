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
import { ALLERGIES, FIRST, LAST, renderParts } from './valuePartsSupport'

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
