import React, { useState } from 'react'
import rmnchProgram from '../api/__fixtures__/program.rmnch.json'
import { page, userEvent } from 'vitest/browser'
import {
    TrackedEntityActions,
    TrackedEntityAttribute,
    TrackedEntityDetails,
    TrackedEntityFacts,
    TrackedEntityName,
} from '..'
import {
    ALLERGIES,
    BIRTH_DATE,
    CITY,
    FIRST,
    LAST,
    renderParts,
    type RawPerson,
} from './valuePartsSupport'

const open = async () => {
    await userEvent.click(page.getByRole('button', { name: 'Details' }))
}

describe('TrackedEntityDetails', () => {
    it('starts collapsed and opens a list in place', async () => {
        await renderParts(<TrackedEntityDetails />)

        const button = page.getByRole('button', { name: 'Details' })
        await expect.element(button).toHaveAttribute('aria-expanded', 'false')
        const list = document.getElementById(
            (await button.element()).getAttribute('aria-controls') ?? ''
        )
        expect(list?.hidden).toBe(true)

        await userEvent.click(button)

        await expect.element(button).toHaveAttribute('aria-expanded', 'true')
        expect(list?.hidden).toBe(false)
        expect(list?.querySelector('dl')).not.toBeNull()
    })

    it('lists the unshown attributes in metadata order, with Not recorded', async () => {
        await renderParts(
            <>
                <TrackedEntityName attributes={[FIRST, LAST]} />
                <TrackedEntityDetails />
            </>,
            {
                person: (raw: RawPerson) => ({
                    ...raw,
                    attributes: raw.attributes.filter(
                        ({ attribute }) => attribute !== ALLERGIES
                    ),
                }),
            }
        )
        await open()

        const terms = page.getByRole('term')
        await expect.element(terms.first()).toBeVisible()
        const labels = (await terms.elements()).map((el) => el.textContent)
        expect(labels.length).toBeGreaterThan(0)
        expect(labels).not.toContain('First name')
        expect(labels).not.toContain('Last name')
        await expect.element(page.getByRole('definition').first()).toBeVisible()
        expect(
            (await page.getByRole('definition').elements()).map(
                (el) => el.textContent
            )
        ).toContain('Not recorded')
    })

    it('skips attributes shown inside Facts, by Name, and after Details', async () => {
        await renderParts(
            <>
                <TrackedEntityName attributes={[FIRST]} />
                <TrackedEntityFacts>
                    <TrackedEntityAttribute attribute={CITY} />
                </TrackedEntityFacts>
                <TrackedEntityDetails />
                <TrackedEntityAttribute attribute={BIRTH_DATE} />
            </>
        )
        await open()

        const list = document.querySelector<HTMLElement>(
            '[data-slot="tracked-entity-details"] dl'
        )
        const labels = [...(list?.querySelectorAll('dt') ?? [])].map(
            (el) => el.textContent
        )
        expect(labels).toContain('Last name')
        expect(labels).not.toContain('First name')
        expect(labels).not.toContain('City')
        expect(labels).not.toContain('Birth date')
    })

    it('never commits its button or a placed row when every attribute is placed elsewhere', async () => {
        const uids = rmnchProgram.programTrackedEntityAttributes.map(
            ({ trackedEntityAttribute }) => trackedEntityAttribute.id
        )
        const Late = () => {
            const [show, setShow] = useState(false)
            return (
                <>
                    <button type="button" onClick={() => setShow(true)}>
                        Show parts
                    </button>
                    {show && (
                        <>
                            <TrackedEntityDetails />
                            {uids.map((uid) => (
                                <TrackedEntityAttribute
                                    key={uid}
                                    attribute={uid}
                                />
                            ))}
                        </>
                    )}
                </>
            )
        }
        await renderParts(<Late />)
        const seen: string[] = []
        const observer = new MutationObserver((records) =>
            records.forEach(({ addedNodes }) =>
                addedNodes.forEach((node) => {
                    if (
                        node instanceof HTMLElement &&
                        (node.dataset.slot === 'tracked-entity-details' ||
                            node.querySelector(
                                '[data-slot="tracked-entity-details"]'
                            ))
                    ) {
                        seen.push(node.outerHTML)
                    }
                })
            )
        )
        observer.observe(document.body, { childList: true, subtree: true })
        await userEvent.click(page.getByRole('button', { name: 'Show parts' }))
        await expect.element(page.getByText('Linda').first()).toBeVisible()
        observer.disconnect()

        expect(seen).toEqual([])
    })

    it('lists an invalid attribute without a label as Attribute, Unavailable, in a list of only dt and dd', async () => {
        await renderParts(<TrackedEntityDetails />, {
            metadata: (raw) => ({
                ...raw,
                programTrackedEntityAttributes:
                    raw.programTrackedEntityAttributes.map((a) =>
                        a.trackedEntityAttribute.id === ALLERGIES
                            ? {
                                  ...a,
                                  // The recorded JSON has no undefined: drop the key.
                                  trackedEntityAttribute: {
                                      id: a.trackedEntityAttribute.id,
                                      optionSet: { options: 'bad' },
                                  },
                              }
                            : a
                    ),
            }),
        })
        await open()

        const list = document.querySelector(
            '[data-slot="tracked-entity-details"] dl'
        )
        expect(
            [...(list?.children ?? [])].every((el) =>
                ['DT', 'DD'].includes(el.tagName)
            )
        ).toBe(true)
        const terms = [...(list?.querySelectorAll('dt') ?? [])]
        const index = terms.findIndex((el) => el.textContent === 'Attribute')
        expect(index).toBeGreaterThanOrEqual(0)
        expect(list?.querySelectorAll('dd')[index]?.textContent).toBe(
            'Unavailable'
        )
    })

    it('lists an attribute again when the part showing it unmounts', async () => {
        const Toggle = () => {
            const [show, setShow] = useState(true)
            return (
                <>
                    <button type="button" onClick={() => setShow(false)}>
                        Hide city
                    </button>
                    {show && <TrackedEntityAttribute attribute={CITY} />}
                    <TrackedEntityDetails />
                </>
            )
        }
        await renderParts(<Toggle />)
        await open()
        const labels = () =>
            [
                ...document.querySelectorAll(
                    '[data-slot="tracked-entity-details"] dt'
                ),
            ].map((el) => el.textContent)
        expect(labels()).not.toContain('City')

        await userEvent.click(page.getByRole('button', { name: 'Hide city' }))

        await expect.poll(labels).toContain('City')
    })

    it('treats null and false children as none', async () => {
        await renderParts(<TrackedEntityDetails>{false}</TrackedEntityDetails>)
        await open()

        expect(document.querySelector('dl')).not.toBeNull()
    })

    it('shows its children instead of the default list', async () => {
        await renderParts(
            <TrackedEntityDetails>
                <p>Custom details</p>
            </TrackedEntityDetails>
        )
        await open()

        await expect.element(page.getByText('Custom details')).toBeVisible()
        expect(document.querySelector('dl')).toBeNull()
    })

    it('renders nothing when nothing is left to list', async () => {
        await renderParts(<TrackedEntityDetails />, {
            metadata: (raw) => ({
                ...raw,
                programTrackedEntityAttributes: [],
            }),
        })

        await expect
            .element(page.getByRole('button', { name: 'Details' }))
            .not.toBeInTheDocument()
    })
})

describe('TrackedEntityFacts and TrackedEntityActions', () => {
    it('Facts and Details render nothing until ready', async () => {
        await renderParts(
            <>
                <TrackedEntityFacts>
                    <p>fact</p>
                </TrackedEntityFacts>
                <TrackedEntityDetails />
            </>,
            { status: 'loading' }
        )

        await expect.element(page.getByText('fact')).not.toBeInTheDocument()
        await expect
            .element(page.getByRole('button', { name: 'Details' }))
            .not.toBeInTheDocument()
    })

    it.each(['loading', 'failed', 'restricted'] as const)(
        'Actions renders its button while %s',
        async (status) => {
            await renderParts(
                <TrackedEntityActions>
                    <button type="button">Edit</button>
                </TrackedEntityActions>,
                { status }
            )

            await expect
                .element(page.getByRole('button', { name: 'Edit' }))
                .toBeVisible()
        }
    )
})
