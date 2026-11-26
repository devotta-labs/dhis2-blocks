import React from 'react'
import { render } from 'vitest-browser-react'
import {
    VisitFact,
    VisitFactLabel,
    VisitFacts,
    VisitFactValue,
    VisitService,
} from '..'

const valueSlots = (container: HTMLElement) => [
    ...container.querySelectorAll('[data-slot="visit-fact-value"]'),
]

describe('visit facts', () => {
    it('pairs a <dt> and <dd> inside a fact list, isolating the value', async () => {
        const { container } = await render(
            <VisitFacts>
                <VisitFact>
                    <VisitFactLabel>Weight</VisitFactLabel>
                    <VisitFactValue>7.4 kg</VisitFactValue>
                </VisitFact>
            </VisitFacts>
        )
        const [value] = valueSlots(container)
        expect(value.tagName).toBe('DD')
        expect(value.parentElement?.parentElement?.tagName).toBe('DL')
        expect(value.querySelector('bdi')).toHaveTextContent('7.4 kg')
        expect(value.getAttribute('data-state')).toBe('value')
    })

    it('renders a span outside a fact, so a table cell never holds a stray <dd>', async () => {
        const { container } = await render(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <VisitFactValue>7.4 kg</VisitFactValue>
                        </td>
                        <td>
                            <VisitFactValue state="missing" />
                        </td>
                        <td>
                            <VisitService>Vaccination</VisitService>
                        </td>
                    </tr>
                </tbody>
            </table>
        )
        expect(container.querySelector('dd')).toBeNull()
        expect(container.querySelector('dt')).toBeNull()
        expect(container.querySelector('li')).toBeNull()
        expect(valueSlots(container).map((value) => value.tagName)).toEqual([
            'SPAN',
            'SPAN',
        ])
    })

    it('tells missing, not performed and restricted values apart in muted words', async () => {
        const screen = await render(
            <VisitFacts>
                {(['missing', 'not-performed', 'restricted'] as const).map(
                    (state) => (
                        <VisitFact key={state}>
                            <VisitFactLabel>{state}</VisitFactLabel>
                            <VisitFactValue state={state} />
                        </VisitFact>
                    )
                )}
            </VisitFacts>
        )
        const [missing, notPerformed, restricted] = valueSlots(screen.container)
        expect(missing).toHaveTextContent('Not recorded')
        expect(restricted).toHaveTextContent('Unavailable')
        expect(
            notPerformed.querySelector('[aria-hidden="true"]')
        ).toHaveTextContent('—')
        expect(notPerformed).toHaveTextContent('Not performed')
        await expect
            .element(screen.getByText('Not performed'))
            .toHaveClass('sr-only')
        for (const value of [missing, notPerformed, restricted]) {
            expect(value.querySelector('bdi')).toBeNull()
            expect(value).toHaveClass('text-dhis2-muted-foreground')
        }
        expect(
            [missing, notPerformed, restricted].map((value) =>
                value.getAttribute('data-state')
            )
        ).toEqual(['missing', 'not-performed', 'restricted'])
    })

    it('lets your words replace a state’s default', async () => {
        const { container } = await render(
            <VisitFactValue state="restricted">Ask the clinic</VisitFactValue>
        )
        const [value] = valueSlots(container)
        expect(value).toHaveTextContent(/^Ask the clinic$/)
        expect(value.getAttribute('data-state')).toBe('restricted')
    })
})
