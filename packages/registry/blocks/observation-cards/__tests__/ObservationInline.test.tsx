import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ObservationCard, ObservationInline, ObservationsProvider } from '..'
import { DE, NORMAL, renderWith } from './support'
import {
    createFakeServer,
    createWrapper,
    WEIGHT,
} from './observationsTestSupport'

const NOW = new Date('2026-03-15T12:00:00.000Z')
const reading = { label: 'Haemoglobin', legends: [NORMAL] }
const inlineOf = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-slot="observation-inline"]')

describe('ObservationInline', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('shows the label, value with unit, legend name and how long ago', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} unit="g/dL" />,
            { ...reading, readings: [{ value: '14', day: '2026-03-11' }] }
        )
        const inline = inlineOf(container)
        expect(inline?.tagName).toBe('DIV')
        expect(inline?.querySelector('dt')?.textContent).toBe('Haemoglobin')
        expect(inline?.querySelector('dd')?.textContent).toContain('14 g/dL')
        expect(inline?.textContent).toContain('Normal')
        expect(inline?.textContent).toContain('4 days ago')
        expect(inline?.textContent).toContain(
            'Recorded Mar 11, 2026 · Antenatal visit'
        )
        expect(inline?.textContent).not.toContain('Out of date')
        expect(inline?.querySelector('[data-slot="chart"]')).toBeNull()
    })

    it('takes the host label over the data element name', async () => {
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} label="Hb" />,
            { readings: [{ value: '14', day: '2026-03-11' }] }
        )
        expect(inlineOf(container)?.querySelector('dt')?.textContent).toBe('Hb')
    })

    it('adds the Out of date note past staleAfterDays', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(NOW)
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} staleAfterDays={2} />,
            { readings: [{ value: '14', day: '2026-03-11' }] }
        )
        expect(inlineOf(container)?.textContent).toContain('Out of date')
        expect(inlineOf(container)?.textContent).toContain(
            'Out of date: last recorded over 2 days ago'
        )
    })

    it('pending shows a skeleton and Loading', async () => {
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} />,
            {},
            'pending'
        )
        expect(
            inlineOf(container)?.querySelector('[data-slot="skeleton"]')
        ).not.toBeNull()
        expect(inlineOf(container)?.textContent).toContain('Loading')
    })

    it('a value never recorded shows Not recorded', async () => {
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} />
        )
        expect(inlineOf(container)?.textContent).toContain('Not recorded')
        expect(inlineOf(container)?.textContent).not.toContain('Unavailable')
    })

    it('a failed request shows Unavailable', async () => {
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} />,
            {},
            'error'
        )
        expect(inlineOf(container)?.textContent).toContain('Haemoglobin')
        expect(inlineOf(container)?.textContent).toContain('Unavailable')
    })

    it('a failure before the metadata loads shows Unavailable, with no dd outside a named dl', async () => {
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} />,
            {},
            'failed-early'
        )
        const inline = inlineOf(container)
        expect(inline?.textContent).toContain('Unavailable')
        expect(inline?.querySelector('dl, dd')).toBeNull()

        const labelled = await renderWith(
            <ObservationInline dataElement={DE} label="Hb" />,
            {},
            'failed-early'
        )
        const named = inlineOf(labelled.container)
        expect(named?.querySelector('dl > dt')?.textContent).toBe('Hb')
        expect(named?.querySelector('dl > dd')?.textContent).toBe('Unavailable')
    })

    it('a partial series with no readable value shows Unavailable', async () => {
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} />,
            { partial: true }
        )
        expect(inlineOf(container)?.textContent).toContain('Unavailable')
        expect(inlineOf(container)?.textContent).not.toContain('Not recorded')
    })

    it('a partial series with a readable value still shows it', async () => {
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} />,
            { partial: true, readings: [{ value: '14', day: '2026-03-11' }] }
        )
        expect(inlineOf(container)?.textContent).toContain('14')
        expect(inlineOf(container)?.textContent).not.toContain('Unavailable')
    })

    it('a data element the program lacks shows the full setup message in development', async () => {
        const { container } = await renderWith(
            <ObservationInline dataElement={DE} />,
            {},
            'misconfigured'
        )
        expect(
            container.querySelector('[data-slot="observation-config-error"]')
                ?.textContent
        ).toContain(`Data element ${DE} is not captured by any stage`)
    })
})

describe('ObservationInline with a provider', () => {
    it('beside a card for the same element, still one events request', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper()
        await render(
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program="prog1"
                    client={server.client}
                >
                    <ObservationCard dataElement={WEIGHT} />
                    <ObservationInline dataElement={WEIGHT} unit="kg" />
                </ObservationsProvider>
            </Wrapper>
        )
        await expect.element(page.getByText('70 kg')).toBeVisible()
        expect(server.countOf('tracker/events')).toBe(1)
        expect(server.requests).toHaveLength(3)
    })

    it('a nested provider for another program shows its own value beside the outer one', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper()
        const { container } = await render(
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program="prog1"
                    client={server.client}
                >
                    <ObservationInline dataElement={WEIGHT} label="Outer" />
                    <ObservationsProvider
                        trackedEntity="te1"
                        program="prog2"
                        client={server.client}
                    >
                        <ObservationInline dataElement={WEIGHT} label="Inner" />
                    </ObservationsProvider>
                </ObservationsProvider>
            </Wrapper>
        )
        await expect.poll(() => container.textContent).toContain('64')
        const values = [
            ...container.querySelectorAll('[data-slot="observation-inline"]'),
        ].map((inline) => inline.textContent)
        expect(values[0]).toContain('Outer')
        expect(values[0]).toContain('70')
        expect(values[1]).toContain('Inner')
        expect(values[1]).toContain('64')
    })
})
