import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { DataEngineValue } from '../api/client'
import {
    TrackedEntityBanner,
    TrackedEntityDetails,
    TrackedEntityFacts,
    TrackedEntityHeaderProvider,
    TrackedEntityName,
    TrackedEntityRelationships,
    type TrackedEntityRelationshipsProps,
} from '..'
import { createFakeServer, createWrapper, RMNCH } from './headerTestSupport'
import { FIRST, LAST } from './valuePartsSupport'

const FOCUS_RECORD = 'neR4cmMY22o'
const FOCUS_TYPE = 'Mv8R4MPcNcX'

type ServerOptions = Parameters<typeof createFakeServer>[0]

const setup = async (
    props: TrackedEntityRelationshipsProps = {},
    options: ServerOptions = { links: 'focus' },
    banner = false
) => {
    const server = createFakeServer(options)
    const Wrapper = createWrapper()
    const part = <TrackedEntityRelationships {...props} />
    await render(
        <Wrapper>
            <TrackedEntityHeaderProvider
                trackedEntity={FOCUS_RECORD}
                program={RMNCH}
                client={server.client}
            >
                {banner ? (
                    <TrackedEntityBanner>
                        <TrackedEntityName attributes={[FIRST, LAST]} />
                        <TrackedEntityFacts>
                            <span>Fact</span>
                        </TrackedEntityFacts>
                        {part}
                    </TrackedEntityBanner>
                ) : (
                    part
                )}
            </TrackedEntityHeaderProvider>
        </Wrapper>
    )
    return server
}

const manyLinks = (count: number) => ({
    relationships: Array.from(
        { length: count },
        (_, index): DataEngineValue => ({
            relationship: `rel${index}`,
            relationshipType: FOCUS_TYPE,
            bidirectional: false,
            from: { trackedEntity: { trackedEntity: FOCUS_RECORD } },
            to: {
                trackedEntity: {
                    trackedEntity: `te${String(index).padStart(9, '0')}`,
                    trackedEntityType: 'Zy2SEgA61ys',
                    attributes: [
                        { attribute: 'aW66s2QSosT', value: `Name ${index}` },
                    ],
                },
            },
        })
    ),
})

describe('TrackedEntityRelationships', () => {
    it('outside a frame, shows a line with the label, count, three names and the rest', async () => {
        await setup()
        await expect
            .element(page.getByRole('term'))
            .toHaveTextContent('Focus to Case')
        await expect
            .element(page.getByRole('definition'))
            .toHaveTextContent(/^5 .*and 2 more$/)
        await expect
            .element(
                page.getByText('5', {
                    exact: true,
                })
            )
            .toBeVisible()
    })

    it('draws three names however many links there are', async () => {
        await setup({}, { relationshipsBody: manyLinks(300) })
        await expect.element(page.getByText('and 297 more')).toBeVisible()
        expect(
            (await page.getByRole('definition').element()).textContent
        ).toMatch(/^300 Name \d+, Name \d+, Name \d+ and 297 more$/)
    })

    it('makes "and N more" a link with `moreHref`', async () => {
        await setup(
            { moreHref: (type) => `/all/${type}` },
            { relationshipsBody: manyLinks(300) }
        )
        const more = page.getByRole('link', {
            name: 'and 297 more Focus to Case',
        })
        await expect.element(more).toHaveAttribute('href', `/all/${FOCUS_TYPE}`)
    })

    it('makes it a button with `onMore` alone', async () => {
        const onMore = vi.fn()
        await setup({ onMore }, { relationshipsBody: manyLinks(300) })
        await userEvent.click(
            page.getByRole('button', { name: 'and 297 more Focus to Case' })
        )
        expect(onMore).toHaveBeenCalledWith(FOCUS_TYPE)
    })

    it('with both, a plain click calls `onMore` and does not follow the link', async () => {
        const onMore = vi.fn()
        await setup(
            { onMore, moreHref: () => '#more' },
            { relationshipsBody: manyLinks(300) }
        )
        window.location.hash = ''
        await userEvent.click(
            page.getByRole('link', { name: 'and 297 more Focus to Case' })
        )
        expect(onMore).toHaveBeenCalledWith(FOCUS_TYPE)
        expect(window.location.hash).toBe('')
    })

    it('with neither, is text', async () => {
        await setup({}, { relationshipsBody: manyLinks(300) })
        await expect.element(page.getByText('and 297 more')).toBeVisible()
        expect(page.getByRole('link').elements()).toHaveLength(0)
        expect(page.getByRole('button').elements()).toHaveLength(0)
    })

    it('relabels a line', async () => {
        await setup({ labels: { [FOCUS_TYPE]: 'Cases' } })
        await expect
            .element(page.getByRole('term'))
            .toHaveTextContent(/^Cases$/)
    })

    it('says so when there are no links, outside a frame', async () => {
        await setup({}, { links: 'none' })
        await expect.element(page.getByText('No related records')).toBeVisible()
    })

    describe('in a banner', () => {
        it('shows nothing when there are no links', async () => {
            const server = await setup({}, { links: 'none' }, true)
            await expect.element(page.getByText('Fact')).toBeVisible()
            await vi.waitFor(() =>
                expect(server.countOf('tracker/relationships')).toBe(1)
            )
            expect(page.getByText('Related').elements()).toHaveLength(0)
            expect(
                document.querySelector(
                    '[data-slot="tracked-entity-relationships"]'
                )
            ).toBeNull()
        })

        it('says Unavailable when the relationships request fails', async () => {
            await setup({}, { relationshipsFail: 500 }, true)
            await expect.element(page.getByText('Related')).toBeVisible()
            await expect.element(page.getByText('Unavailable')).toBeVisible()
        })

        it('starts closed and opens the list below the facts', async () => {
            await setup({}, { links: 'focus' }, true)
            const button = page.getByRole('button', { name: 'Related 5' })
            await expect
                .element(button)
                .toHaveAttribute('aria-expanded', 'false')
            expect(page.getByRole('term').elements()).toHaveLength(0)

            await userEvent.click(button)

            await expect
                .element(button)
                .toHaveAttribute('aria-expanded', 'true')
            const term = page.getByRole('term')
            await expect.element(term).toHaveTextContent('Focus to Case')
            const facts = document.querySelector(
                '[data-slot="tracked-entity-facts"]'
            )
            expect(term.element().getBoundingClientRect().top).toBeGreaterThan(
                facts?.getBoundingClientRect().bottom ?? Infinity
            )
        })

        it('lines its toggle up with Details below the facts, wherever both are placed', async () => {
            const server = createFakeServer({ links: 'focus' })
            const Wrapper = createWrapper()
            await render(
                <Wrapper>
                    <TrackedEntityHeaderProvider
                        trackedEntity={FOCUS_RECORD}
                        program={RMNCH}
                        client={server.client}
                    >
                        <TrackedEntityBanner>
                            <TrackedEntityRelationships />
                            <TrackedEntityName attributes={[FIRST, LAST]} />
                            <TrackedEntityDetails />
                            <TrackedEntityFacts>
                                <span>Fact</span>
                            </TrackedEntityFacts>
                        </TrackedEntityBanner>
                    </TrackedEntityHeaderProvider>
                </Wrapper>
            )
            const related = page.getByRole('button', { name: 'Related 5' })
            await expect.element(related).toBeVisible()
            const details = page.getByRole('button', { name: /^Details \d+$/ })
            const factsBottom =
                document
                    .querySelector('[data-slot="tracked-entity-facts"]')
                    ?.getBoundingClientRect().bottom ?? Infinity
            const relatedBox = related.element().getBoundingClientRect()
            const detailsBox = details.element().getBoundingClientRect()
            expect(relatedBox.top).toBeGreaterThan(factsBottom)
            expect(Math.abs(detailsBox.top - relatedBox.top)).toBeLessThan(1)

            await userEvent.click(related)

            const term = page.getByRole('term')
            await expect.element(term).toHaveTextContent('Focus to Case')
            expect(term.element().getBoundingClientRect().top).toBeGreaterThan(
                relatedBox.bottom
            )
        })

        it('shows nothing, and asks for nothing, when the banner is restricted', async () => {
            const server = await setup({}, { forbidden: true }, true)
            await expect
                .element(
                    page.getByText("You don't have access", { exact: false })
                )
                .toBeVisible()
            expect(page.getByText('Related').elements()).toHaveLength(0)
            expect(server.countOf('tracker/relationships')).toBe(0)
        })
    })
})
