import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    TrackedEntityHeaderProvider,
    TrackedEntityRelationship,
    TrackedEntityRelationships,
    type TrackedEntityRelationshipProps,
} from '..'
import {
    CASE_RECORD,
    createFakeServer,
    createWrapper,
    RMNCH,
} from './headerTestSupport'

const FOCUS_RECORD = 'neR4cmMY22o'
const FOCUS_TYPE = 'Mv8R4MPcNcX'
const INDEX_TYPE = 'm6XJSapEvOa'
const BIDIRECTIONAL_TYPE = 'mxZDvSZYxlw'

type ServerOptions = Parameters<typeof createFakeServer>[0]

const setup = async (
    props: Partial<TrackedEntityRelationshipProps> = {},
    options: ServerOptions = { links: 'focus' },
    trackedEntity = FOCUS_RECORD
) => {
    const server = createFakeServer(options)
    const Wrapper = createWrapper(server.data)
    await render(
        <Wrapper>
            <TrackedEntityHeaderProvider
                trackedEntity={trackedEntity}
                program={RMNCH}
            >
                <TrackedEntityRelationship
                    relationshipType={FOCUS_TYPE}
                    {...props}
                />
            </TrackedEntityHeaderProvider>
        </Wrapper>
    )
    return server
}

const person = (id: string) => ({
    trackedEntity: {
        trackedEntity: id,
        trackedEntityType: 'Zy2SEgA61ys',
        attributes: [{ attribute: 'aW66s2QSosT', value: `Name ${id}` }],
    },
})
type End = {
    trackedEntity?: { trackedEntity: string; trackedEntityType?: string }
    event?: { event: string }
}
const link = (type: string, from: End, to: End) => ({
    relationship: `${type}-${JSON.stringify(to).length}`,
    relationshipType: type,
    bidirectional: false,
    from,
    to,
})
const body = (...relationships: object[]) => ({ relationships })
const facts = () => page.getByRole('definition')
const labels = () => page.getByRole('term')

describe('TrackedEntityRelationship', () => {
    it('shows the type name, the first three names and how many more', async () => {
        await setup()
        await expect.element(labels()).toHaveTextContent('Focus to Case')
        await expect.element(facts()).toHaveTextContent(/and 2 more$/)
        expect(facts().element().textContent?.split(', ')).toHaveLength(3)
    })

    it('replaces the label', async () => {
        await setup({ label: 'Cases' })
        await expect.element(labels()).toHaveTextContent(/^Cases$/)
    })

    it('picks an end label for the record end', async () => {
        await setup({ label: { from: 'Cases', to: 'Focus' }, end: 'from' })
        await expect.element(labels()).toHaveTextContent(/^Cases$/)
    })

    it('makes a pair of each end of a one-way type', async () => {
        const relationshipsBody = body(
            link(INDEX_TYPE, person(CASE_RECORD), person('aaaaaaaaaa1')),
            link(INDEX_TYPE, person('bbbbbbbbbb1'), person(CASE_RECORD))
        )
        const props = { relationshipType: INDEX_TYPE }
        await setup(props, { relationshipsBody }, CASE_RECORD)
        await expect.poll(() => labels().elements()).toHaveLength(2)
    })

    it('picks the `to` label for the `to` end', async () => {
        const relationshipsBody = body(
            link(INDEX_TYPE, person('bbbbbbbbbb1'), person(CASE_RECORD))
        )
        await setup(
            {
                relationshipType: INDEX_TYPE,
                label: { from: 'Cases', to: 'Index' },
            },
            { relationshipsBody },
            CASE_RECORD
        )
        await expect.element(labels()).toHaveTextContent(/^Index$/)
    })

    it('keeps one pair for `end`', async () => {
        const relationshipsBody = body(
            link(INDEX_TYPE, person(CASE_RECORD), person('aaaaaaaaaa1')),
            link(INDEX_TYPE, person('bbbbbbbbbb1'), person(CASE_RECORD))
        )
        await setup(
            { relationshipType: INDEX_TYPE, end: 'from' },
            { relationshipsBody },
            CASE_RECORD
        )
        await expect.element(facts()).toHaveTextContent('Name aaaaaaaaaa1')
        expect(labels().elements()).toHaveLength(1)
    })

    it('makes one pair of a bidirectional type whatever its end', async () => {
        const relationshipsBody = {
            relationships: [
                {
                    ...link(
                        BIDIRECTIONAL_TYPE,
                        { event: { event: 'ev000000001' } },
                        person(CASE_RECORD)
                    ),
                    bidirectional: true,
                },
            ],
        }
        await setup(
            { relationshipType: BIDIRECTIONAL_TYPE, end: 'from' },
            { relationshipsBody },
            CASE_RECORD
        )
        await expect.element(facts()).toHaveTextContent('1 event')
    })

    it('says "Not recorded" without a link of the type', async () => {
        await setup({ relationshipType: INDEX_TYPE, label: 'Index' })
        await expect.element(page.getByText('Not recorded')).toBeVisible()
        await expect.element(labels()).toHaveTextContent('Index')
    })

    it('labels the empty pair with the type, one request for the types', async () => {
        const server = await setup({ relationshipType: INDEX_TYPE })
        await expect.element(page.getByText('Not recorded')).toBeVisible()
        await expect.element(labels()).toHaveTextContent('Index case to cases')
        expect(server.countOf('relationshipTypes')).toBe(1)
        expect(server.countOf('trackedEntityAttributes')).toBe(1)
    })

    it('labels the empty pair with the type, with no links at all', async () => {
        const server = await setup(
            { relationshipType: BIDIRECTIONAL_TYPE },
            { links: 'none' }
        )
        await expect.element(page.getByText('Not recorded')).toBeVisible()
        await expect.element(labels()).toHaveTextContent('Subject person')
        expect(server.countOf('relationshipTypes')).toBe(1)
        expect(server.countOf('trackedEntityAttributes')).toBe(0)
    })

    it('labels the empty pair by `end`', async () => {
        await setup(
            { relationshipType: INDEX_TYPE, end: 'from' },
            { links: 'none' }
        )
        await expect.element(labels()).toHaveTextContent('Index case to cases')
    })

    it('names an unlinked one-way type by its own name, not `label.from`', async () => {
        await setup(
            {
                relationshipType: INDEX_TYPE,
                label: { from: 'Cases', to: 'Index' },
            },
            { links: 'none' }
        )
        await expect.element(labels()).toHaveTextContent('Index case to cases')
    })

    it('labels the empty pair by the `end` of an object `label`', async () => {
        await setup(
            {
                relationshipType: INDEX_TYPE,
                end: 'to',
                label: { from: 'Cases', to: 'Index' },
            },
            { links: 'none' }
        )
        await expect.element(labels()).toHaveTextContent(/^Index$/)
    })

    it('asks for the types once with the list and a part for an unlinked type', async () => {
        const server = createFakeServer({ links: 'focus' })
        const Wrapper = createWrapper(server.data)
        await render(
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity={FOCUS_RECORD}
                    program={RMNCH}
                >
                    <TrackedEntityRelationships />
                    <TrackedEntityRelationship relationshipType={INDEX_TYPE} />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )
        await expect.element(page.getByText('Not recorded')).toBeVisible()
        await expect
            .element(labels().getByText('Index case to cases'))
            .toBeVisible()
        expect(server.countOf('relationshipTypes')).toBe(1)
    })

    it('fetches the union once more for a part that mounts after the data loaded', async () => {
        const server = createFakeServer({ links: 'focus' })
        const Wrapper = createWrapper(server.data)
        const tree = (withSingle: boolean) => (
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity={FOCUS_RECORD}
                    program={RMNCH}
                >
                    <TrackedEntityRelationships />
                    {withSingle && (
                        <TrackedEntityRelationship
                            relationshipType={INDEX_TYPE}
                        />
                    )}
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )
        const screen = await render(tree(false))
        await expect.element(page.getByText('Focus to Case')).toBeVisible()
        expect(server.countOf('relationshipTypes')).toBe(1)
        await screen.rerender(tree(true))
        await expect.element(page.getByText('Not recorded')).toBeVisible()
        await expect
            .element(labels().getByText('Index case to cases'))
            .toBeVisible()
        // The union gains a type, so its key changes: one request before, one after.
        expect(server.countOf('relationshipTypes')).toBe(2)
    })

    it('asks for the types once with two parts for two unlinked types', async () => {
        const server = createFakeServer({ links: 'none' })
        const Wrapper = createWrapper(server.data)
        await render(
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity={FOCUS_RECORD}
                    program={RMNCH}
                >
                    <TrackedEntityRelationship relationshipType={INDEX_TYPE} />
                    <TrackedEntityRelationship
                        relationshipType={BIDIRECTIONAL_TYPE}
                    />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )
        await expect.element(page.getByText('Subject person')).toBeVisible()
        await expect
            .element(page.getByText('Index case to cases'))
            .toBeVisible()
        expect(server.countOf('relationshipTypes')).toBe(1)
    })

    it('shows nothing, when told, without a link of the type', async () => {
        const server = await setup({ hideWhenEmpty: true }, { links: 'none' })
        await expect.poll(() => server.countOf('tracker/relationships')).toBe(1)
        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(document.body.textContent).not.toContain('Not recorded')
        expect(labels().elements()).toHaveLength(0)
    })

    it('says "Unavailable" when the request fails, even when hiding', async () => {
        await setup(
            { hideWhenEmpty: true },
            { links: 'focus', relationshipsFail: 500 }
        )
        await expect.element(page.getByText('Unavailable')).toBeVisible()
    })

    it('shows a skeleton while loading', async () => {
        const server = await setup(
            {},
            { links: 'focus', deferRelationships: true }
        )
        await expect
            .poll(() => document.querySelector('[data-slot="skeleton"]'))
            .not.toBeNull()
        expect(
            document.querySelector('[data-slot="skeleton"]')?.className
        ).toContain('h-5')
        server.release()
        await expect.element(labels()).toBeVisible()
    })

    it('counts events', async () => {
        const relationshipsBody = body(
            link(BIDIRECTIONAL_TYPE, person(CASE_RECORD), {
                event: { event: 'ev000000001' },
            }),
            link(BIDIRECTIONAL_TYPE, person(CASE_RECORD), {
                event: { event: 'ev000000002' },
            })
        )
        await setup(
            { relationshipType: BIDIRECTIONAL_TYPE },
            { relationshipsBody },
            CASE_RECORD
        )
        await expect.element(facts()).toHaveTextContent('2 events')
    })

    describe('navigation', () => {
        afterEach(() => {
            window.location.hash = ''
        })

        it('renders a link for `href`', async () => {
            await setup({ href: (id) => `/te/${id}` })
            const first = page.getByRole('link').first()
            await expect
                .element(first)
                .toHaveAttribute('href', expect.stringMatching(/^\/te\//))
        })

        it('renders a button for `onSelect` alone', async () => {
            const onSelect = vi.fn()
            await setup({ onSelect })
            expect(page.getByRole('link').elements()).toHaveLength(0)
            await page.getByRole('button').first().click()
            expect(onSelect).toHaveBeenCalledTimes(1)
            expect(onSelect).toHaveBeenCalledWith(expect.any(String))
        })

        it('with both, a plain click selects and a modified one does not', async () => {
            const onSelect = vi.fn()
            await setup({ href: (id) => `#${id}`, onSelect })
            const first = page.getByRole('link').first()
            await first.click()
            expect(onSelect).toHaveBeenCalledTimes(1)
            expect(window.location.hash).toBe('')
            const prevented: boolean[] = []
            const seen = (event: Event) =>
                prevented.push(event.defaultPrevented)
            document.addEventListener('click', seen)
            // A real ctrl-click would open a tab; the event alone shows what the handler does.
            first.element().dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    ctrlKey: true,
                })
            )
            document.removeEventListener('click', seen)
            expect(onSelect).toHaveBeenCalledTimes(1)
            expect(prevented).toEqual([false])
        })

        it('renders plain text with neither', async () => {
            await setup()
            expect(page.getByRole('link').elements()).toHaveLength(0)
            expect(page.getByRole('button').elements()).toHaveLength(0)
        })
    })

    it('shows an unreadable link as no access, never a link', async () => {
        const relationshipsBody = body(
            link(INDEX_TYPE, person(CASE_RECORD), {
                trackedEntity: { trackedEntity: 'hidden00001' },
            })
        )
        await setup(
            {
                relationshipType: INDEX_TYPE,
                href: (id) => `/te/${id}`,
                onSelect: () => {},
            },
            { relationshipsBody },
            CASE_RECORD
        )
        await expect
            .element(page.getByText("You don't have access to this record"))
            .toBeVisible()
        expect(page.getByRole('link').elements()).toHaveLength(0)
        expect(page.getByRole('button').elements()).toHaveLength(0)
        expect(document.body.textContent).not.toContain('hidden00001')
    })
})
