import { Button } from '@/components/dhis2/ui/button'
import React, { type ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    TrackedEntityActions,
    TrackedEntityAttribute,
    TrackedEntityBanner,
    TrackedEntityBorn,
    TrackedEntityDetails,
    TrackedEntityEnrollment,
    TrackedEntityFacts,
    TrackedEntityHeaderProvider,
    TrackedEntityName,
    TrackedEntityOwner,
    TrackedEntityStatus,
} from '..'
import { roleColour } from '../../../test/roleColour'
import { createFakeServer, createWrapper, RMNCH } from './headerTestSupport'
import {
    ALLERGIES,
    BIRTH_DATE,
    FIRST,
    LAST,
    renderParts,
    type Edit,
    type RawPerson,
    type RawProgram,
} from './valuePartsSupport'

const UNIQUE_ID = 'lZGmxYbs97q'

const banner = () => page.getByRole('region').element()

const flags =
    (inactive: boolean, potentialDuplicate = false): Edit<RawPerson> =>
    (raw) => ({ ...raw, inactive, potentialDuplicate })

const forbidden = () => {
    throw Object.assign(new Error('no'), { httpStatusCode: 403 })
}

const Composed = () => (
    <TrackedEntityBanner>
        <TrackedEntityName attributes={[FIRST, LAST]} />
        <TrackedEntityStatus />
        <TrackedEntityBorn attribute={BIRTH_DATE} />
        <TrackedEntityAttribute attribute={UNIQUE_ID} />
        <TrackedEntityActions>
            <Button>Record visit</Button>
        </TrackedEntityActions>
        <TrackedEntityFacts>
            <TrackedEntityAttribute attribute={ALLERGIES} />
            <TrackedEntityOwner />
            <TrackedEntityEnrollment />
        </TrackedEntityFacts>
        <TrackedEntityDetails />
    </TrackedEntityBanner>
)

/** Name and one fact on line one, one fact on line two: the two-line banner. */
const TwoLines = () => (
    <TrackedEntityBanner>
        <TrackedEntityName attributes={[FIRST, LAST]} />
        <TrackedEntityAttribute attribute={UNIQUE_ID} />
        <TrackedEntityFacts>
            <TrackedEntityAttribute attribute={ALLERGIES} />
        </TrackedEntityFacts>
    </TrackedEntityBanner>
)

describe('TrackedEntityBanner', () => {
    it('is a section labelled by the name heading', async () => {
        await renderParts(<Composed />)

        const region = page.getByRole('region', { name: 'Linda Bailey' })
        await expect.element(region).toBeVisible()
        const section = region.element()
        expect(section.tagName).toBe('SECTION')
        expect(section.getAttribute('data-slot')).toBe('tracked-entity-banner')
        expect(section.getAttribute('aria-labelledby')).toBe(
            page.getByRole('heading', { name: 'Linda Bailey' }).element().id
        )
    })

    it('without a name part, is labelled by the type name', async () => {
        await renderParts(<TrackedEntityBanner />)

        await expect
            .element(page.getByRole('region', { name: 'Person' }))
            .toBeVisible()
    })

    it('shows the list attributes in order, then the tags, then the details with the rest', async () => {
        await renderParts(<TrackedEntityBanner />, { person: flags(true) })

        await expect.element(page.getByText('Linda')).toBeVisible()
        const section = banner()
        const labels = [
            ...section.querySelectorAll(
                '[data-slot="tracked-entity-fact"] > dt'
            ),
        ].map((dt) => dt.textContent)
        expect(labels).toEqual([
            'Unique ID',
            'First name',
            'Last name',
            'Mobile number',
            'Email address',
            'Allergies',
        ])
        expect(
            [...section.children].map((child) =>
                child.getAttribute('data-slot')
            )
        ).toEqual([
            ...Array(6).fill('tracked-entity-fact'),
            'tracked-entity-status',
            'tracked-entity-details',
        ])

        await page.getByRole('button', { name: 'Details' }).click()
        const details = section.querySelector(
            '[data-slot="tracked-entity-details"]'
        )
        const rest = [...(details?.querySelectorAll('dt') ?? [])].map(
            (dt) => dt.textContent
        )
        expect(rest).toEqual([
            'Address',
            'Postal code',
            'City',
            'Birth date',
            'Civil status',
        ])
    })

    it('with children, shows only the children', async () => {
        await renderParts(
            <TrackedEntityBanner>
                <TrackedEntityName attributes={[FIRST, LAST]} />
            </TrackedEntityBanner>,
            { person: flags(true) }
        )

        await expect
            .element(page.getByRole('heading', { name: 'Linda Bailey' }))
            .toBeVisible()
        expect(banner().textContent).toBe('Linda Bailey')
    })

    it('shows a skeleton while loading, busy, the height of the loaded banner', async () => {
        await renderParts(<TwoLines />, { status: 'loading' })
        const loading = page.getByRole('region', { name: 'Person record' })
        await expect.element(loading).toHaveAttribute('aria-busy', 'true')
        const skeleton = loading.element()
        expect(
            skeleton.querySelectorAll('[data-slot="skeleton"]').length
        ).toBeGreaterThan(0)
        expect(skeleton.textContent).not.toContain('Not recorded')

        await renderParts(<TwoLines />)
        const loaded = page.getByRole('region', { name: 'Linda Bailey' })
        await expect.element(loaded).toBeVisible()
        expect(loaded.element().hasAttribute('aria-busy')).toBe(false)
        const height = (element: Element) =>
            element.getBoundingClientRect().height
        expect(
            Math.abs(height(skeleton) - height(loaded.element()))
        ).toBeLessThanOrEqual(1)
    })

    it('failed: says so and retries until ready', async () => {
        const server = createFakeServer({ fail: 500 })
        const Wrapper = createWrapper()
        await render(
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity="te1"
                    program={RMNCH}
                    client={server.client}
                >
                    <Composed />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )

        const region = page.getByRole('region', { name: 'Person record' })
        await expect
            .element(region.getByText("Couldn't load this person"))
            .toBeVisible()
        expect(region.element().textContent).not.toContain('Record visit')

        server.recover()
        await region.getByRole('button', { name: 'Retry' }).click()

        await expect
            .element(page.getByRole('region', { name: 'Linda Bailey' }))
            .toBeVisible()
    })

    it("restricted: names the program, shows no values, keeps the host's actions", async () => {
        await renderParts(<Composed />, { status: 'restricted' })

        const region = page.getByRole('region', { name: 'Person record' })
        await expect
            .element(
                region.getByText(
                    "You don't have access to this person's record in WHO RMNCH Tracker"
                )
            )
            .toBeVisible()
        await expect
            .element(region.getByRole('button', { name: 'Record visit' }))
            .toBeVisible()
        const text = region.element().textContent ?? ''
        for (const value of ['Linda', 'Bailey', '9411202', 'Penicillin']) {
            expect(text).not.toContain(value)
        }
        expect(text).not.toContain('Not recorded')
        expect(text).not.toContain('Unavailable')
    })

    it('restricted with no program name: the message without a program', async () => {
        const blocked: Edit<RawProgram> = forbidden
        await renderParts(<TrackedEntityBanner />, {
            status: 'loading',
            metadata: blocked,
        })

        await expect
            .element(
                page.getByText(
                    "You don't have access to this person's record",
                    { exact: true }
                )
            )
            .toBeVisible()
    })

    it('inactive: the muted surface and the Inactive tag', async () => {
        await renderParts(<TrackedEntityBanner />, { person: flags(true) })

        await expect.element(page.getByText('Inactive')).toBeVisible()
        const section = banner()
        expect(section.getAttribute('data-tone')).toBe('inactive')
        expect(getComputedStyle(section).backgroundColor).toBe(
            roleColour('muted')
        )
    })

    it('active: the default tone on the card surface', async () => {
        await renderParts(<TrackedEntityBanner />)

        await expect.element(page.getByText('Linda')).toBeVisible()
        const section = banner()
        expect(section.getAttribute('data-tone')).toBe('default')
        expect(getComputedStyle(section).backgroundColor).toBe(
            roleColour('card')
        )
    })

    it('a new trackedEntity never renders the old name', async () => {
        const server = createFakeServer({ deferFor: 'te2' })
        const Wrapper = createWrapper()
        const at = (trackedEntity: string) => (
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity={trackedEntity}
                    program={RMNCH}
                    client={server.client}
                >
                    <Composed />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )
        const screen = await render(at('te1'))
        await expect
            .element(page.getByRole('region', { name: 'Linda Bailey' }))
            .toBeVisible()

        const seen: string[] = []
        const observer = new MutationObserver(() =>
            seen.push(screen.container.textContent ?? '')
        )
        observer.observe(screen.container, {
            subtree: true,
            childList: true,
            characterData: true,
        })
        await screen.rerender(at('te2'))
        seen.push(screen.container.textContent ?? '')
        await expect
            .element(page.getByRole('region', { name: 'Person record' }))
            .toHaveAttribute('aria-busy', 'true')
        observer.disconnect()

        expect(seen.length).toBeGreaterThan(0)
        expect(seen.filter((text) => text.includes('Linda Bailey'))).toEqual([])
        server.release()
    })
})

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
