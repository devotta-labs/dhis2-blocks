import React from 'react'
import { page } from 'vitest/browser'
import { Probe } from './headerTestSupport'
import {
    TrackedEntityAttribute,
    TrackedEntityDate,
    TrackedEntityName,
} from '..'
import {
    ALLERGIES,
    BIRTH_DATE,
    CHILD,
    CITY,
    FIRST,
    LAST,
    renderParts,
    type RawPerson,
    type RawProgram,
} from './valuePartsSupport'

const withoutValues =
    (...uids: string[]) =>
    (raw: RawPerson) => ({
        ...raw,
        attributes: raw.attributes.filter(
            ({ attribute }: { attribute: string }) => !uids.includes(attribute)
        ),
    })

describe('TrackedEntityName', () => {
    it('joins the names with a space in a level 2 heading', async () => {
        await renderParts(<TrackedEntityName attributes={[FIRST, LAST]} />)

        await expect
            .element(page.getByRole('heading', { level: 2 }))
            .toHaveTextContent('Linda Bailey')
    })

    it('takes the id it is given, or makes one', async () => {
        await renderParts(
            <>
                <TrackedEntityName id="who" attributes={[FIRST]} />
                <TrackedEntityName attributes={[LAST]} />
            </>
        )

        const headings = page.getByRole('heading')
        await expect.element(headings.first()).toHaveAttribute('id', 'who')
        await expect.element(headings.last()).toHaveAttribute('id')
    })

    it('says Name not recorded when every name is missing', async () => {
        await renderParts(<TrackedEntityName attributes={[FIRST, LAST]} />, {
            person: withoutValues(FIRST, LAST),
        })

        await expect
            .element(page.getByRole('heading', { level: 2 }))
            .toHaveTextContent('Name not recorded')
    })

    it.each(['loading', 'failed', 'restricted'] as const)(
        'renders nothing while %s',
        async (status) => {
            await renderParts(
                <>
                    <Probe />
                    <div data-testid="part">
                        <TrackedEntityName attributes={[FIRST, LAST]} />
                    </div>
                </>,
                { status }
            )

            await expect
                .element(page.getByTestId('state'))
                .toHaveTextContent(status)
            expect(page.getByTestId('part').element().childElementCount).toBe(0)
        }
    )
})

const unreadable =
    (...uids: string[]) =>
    (raw: RawProgram) => ({
        ...raw,
        programTrackedEntityAttributes: raw.programTrackedEntityAttributes.map(
            (a) =>
                uids.includes(a.trackedEntityAttribute.id)
                    ? {
                          ...a,
                          trackedEntityAttribute: {
                              ...a.trackedEntityAttribute,
                              optionSet: { options: 'bad' },
                          },
                      }
                    : a
        ),
    })

describe('TrackedEntityName unavailable', () => {
    it('says Name unavailable when every name attribute is unreadable', async () => {
        await renderParts(<TrackedEntityName attributes={[FIRST, LAST]} />, {
            metadata: unreadable(FIRST, LAST),
        })

        await expect
            .element(page.getByRole('heading', { level: 2 }))
            .toHaveTextContent('Name unavailable')
    })

    it('never shows half a name when one attribute is unreadable', async () => {
        await renderParts(<TrackedEntityName attributes={[FIRST, LAST]} />, {
            metadata: unreadable(FIRST),
        })

        const heading = page.getByRole('heading', { level: 2 })
        await expect.element(heading).toHaveTextContent('Name unavailable')
        await expect.element(heading).not.toHaveTextContent('Bailey')
    })
})

describe('TrackedEntityAttribute', () => {
    it('pairs the label with its value as a term and its definition', async () => {
        await renderParts(<TrackedEntityAttribute attribute={CITY} />)

        await expect.element(page.getByRole('term')).toHaveTextContent('City')
        await expect
            .element(page.getByRole('definition'))
            .toHaveTextContent('Not recorded')
        const term = page.getByRole('term').element()
        expect(term.nextElementSibling).toBe(
            page.getByRole('definition').element()
        )
    })

    it('shows the label and the value', async () => {
        await renderParts(<TrackedEntityAttribute attribute={FIRST} />)

        await expect.element(page.getByText('First name')).toBeVisible()
        await expect.element(page.getByText('Linda')).toBeVisible()
    })

    it('says Not recorded for an attribute the person has no value for', async () => {
        await renderParts(<TrackedEntityAttribute attribute={CITY} />)

        await expect.element(page.getByText('City')).toBeVisible()
        await expect.element(page.getByText('Not recorded')).toBeVisible()
    })

    it('uses the label it is given', async () => {
        await renderParts(
            <TrackedEntityAttribute attribute={FIRST} label="Given name" />
        )

        await expect.element(page.getByText('Given name')).toBeVisible()
        expect(page.getByText('First name').elements()).toHaveLength(0)
    })

    it('shows option names, never codes, for a multi-select', async () => {
        await renderParts(<TrackedEntityAttribute attribute={ALLERGIES} />, {
            person: (raw) => ({
                ...raw,
                attributes: raw.attributes.map((a) =>
                    a.attribute === ALLERGIES
                        ? { ...a, value: 'Penicillin,SULFA' }
                        : a
                ),
            }),
        })

        await expect.element(page.getByText('Allergies')).toBeVisible()
        await expect
            .element(
                page.getByText(
                    'Penicillin and related antibiotics, Antibiotics containing sulfonamides (sulfa drugs)'
                )
            )
            .toBeVisible()
    })

    it('shows Unavailable for an attribute whose metadata is malformed, and values for its neighbours', async () => {
        await renderParts(
            <>
                <TrackedEntityAttribute attribute={ALLERGIES} />
                <TrackedEntityAttribute attribute={FIRST} />
            </>,
            {
                metadata: (raw) => ({
                    ...raw,
                    programTrackedEntityAttributes:
                        raw.programTrackedEntityAttributes.map((a) =>
                            a.trackedEntityAttribute.id === ALLERGIES
                                ? {
                                      ...a,
                                      trackedEntityAttribute: {
                                          ...a.trackedEntityAttribute,
                                          optionSet: { options: 'bad' },
                                      },
                                  }
                                : a
                        ),
                }),
            }
        )

        await expect.element(page.getByText('Unavailable')).toBeVisible()
        await expect.element(page.getByText('Linda')).toBeVisible()
    })

    it('says what is wrong, in development, for an attribute the program lacks', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        await renderParts(<TrackedEntityAttribute attribute="nope0000001" />)

        const message = page.getByRole('alert')
        await expect.element(message).toHaveTextContent('nope0000001')
        await expect
            .element(message)
            .toHaveTextContent(`program ${'WSGAb5XwJ3Y'}`)
        expect(error).not.toHaveBeenCalled()
        error.mockRestore()
    })

    it.each(['loading', 'failed', 'restricted'] as const)(
        'renders nothing while %s',
        async (status) => {
            await renderParts(
                <>
                    <Probe />
                    <div data-testid="part">
                        <TrackedEntityAttribute attribute={FIRST} />
                    </div>
                </>,
                { status }
            )

            await expect
                .element(page.getByTestId('state'))
                .toHaveTextContent(status)
            expect(page.getByTestId('part').element().childElementCount).toBe(0)
        }
    )
})

describe('TrackedEntityDate', () => {
    it('shows a date attribute in the system calendar', async () => {
        await renderParts(<TrackedEntityDate attribute={BIRTH_DATE} />)

        await expect.element(page.getByText('Birth date')).toBeVisible()
        await expect.element(page.getByText('May 28, 1992')).toBeVisible()
    })

    it("shows the enrollment's occurredAt, labelled by the program's incident date label", async () => {
        await renderParts(<TrackedEntityDate enrollmentDate="occurredAt" />, {
            program: CHILD,
        })

        await expect.element(page.getByText('Date of birth')).toBeVisible()
        await expect.element(page.getByText('Mar 4, 2026')).toBeVisible()
    })

    it('says Not recorded under the label when the person has no enrollment in the program', async () => {
        await renderParts(<TrackedEntityDate enrollmentDate="occurredAt" />, {
            program: CHILD,
            person: (raw) => ({ ...raw, enrollments: [] }),
        })

        await expect.element(page.getByText('Date of birth')).toBeVisible()
        await expect.element(page.getByText('Not recorded')).toBeVisible()
    })

    it('names the missing program prop when there is none', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        await renderParts(<TrackedEntityDate enrollmentDate="enrolledAt" />, {
            program: null,
        })

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent('program prop')
        error.mockRestore()
    })

    it.each(['loading', 'failed', 'restricted'] as const)(
        'renders nothing while %s',
        async (status) => {
            await renderParts(
                <>
                    <Probe />
                    <div data-testid="part">
                        <TrackedEntityDate attribute={BIRTH_DATE} />
                    </div>
                </>,
                { status }
            )

            await expect
                .element(page.getByTestId('state'))
                .toHaveTextContent(status)
            expect(page.getByTestId('part').element().childElementCount).toBe(0)
        }
    )
})
