import React, { type ErrorInfo, type ReactNode } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ObservationCard } from '../card/ObservationCard'
import { ObservationsProvider } from '../provider/ObservationsProvider'
import {
    createFakeServer,
    createWrapper,
    HEIGHT,
    TEMP,
    WEIGHT,
} from './observationsTestSupport'

interface Caught {
    message?: string
}

class Catch extends React.Component<{ children: ReactNode }, Caught> {
    state: Caught = {}

    static getDerivedStateFromError(error: Error) {
        return { message: error.message }
    }

    componentDidCatch(_error: Error, _info: ErrorInfo) {}

    render() {
        return this.state.message === undefined ? (
            this.props.children
        ) : (
            <p data-testid="caught">{this.state.message}</p>
        )
    }
}

const card = (name: string) => page.getByRole('group', { name, exact: true })

const valueOf = (name: string) =>
    card(name).element().querySelector('[data-slot="observation-value"]')
        ?.textContent

describe('ObservationsProvider', () => {
    it('one metadata, one enrollment and one events request for any number of cards', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper(server.data)

        await render(
            <Wrapper>
                <ObservationsProvider trackedEntity="te1" program="prog1">
                    <ObservationCard dataElement={WEIGHT} />
                    <ObservationCard dataElement={TEMP} />
                    <ObservationCard dataElement={HEIGHT} />
                </ObservationsProvider>
            </Wrapper>
        )

        await expect.poll(() => valueOf('Weight')).toBe('70')
        await expect
            .element(card('Temperature'))
            .toHaveTextContent('Never recorded')
        await expect.element(card('Height')).toHaveTextContent('Never recorded')
        expect(server.countOf('programs')).toBe(1)
        expect(server.countOf('tracker/enrollments')).toBe(1)
        expect(server.countOf('tracker/events')).toBe(1)
        expect(server.requests).toHaveLength(3)
    })

    it.each([
        { change: 'trackedEntity', next: ['te2', 'prog1'], weight: '82' },
        { change: 'program', next: ['te1', 'prog2'], weight: '64' },
    ])(
        'switching $change shows a loading card before the new series',
        async ({ next: [trackedEntity = '', program = ''], weight }) => {
            const server = createFakeServer({
                deferEventsFor: trackedEntity === 'te1' ? program : 'te2',
            })
            const Wrapper = createWrapper(server.data)
            const ui = (ids: { trackedEntity: string; program: string }) => (
                <Wrapper>
                    <ObservationsProvider {...ids}>
                        <ObservationCard dataElement={WEIGHT} label="Weight" />
                    </ObservationsProvider>
                </Wrapper>
            )

            const screen = await render(
                ui({ trackedEntity: 'te1', program: 'prog1' })
            )
            await expect.poll(() => valueOf('Weight')).toBe('70')

            await screen.rerender(ui({ trackedEntity, program }))
            // The very next frame: the previous person's value is gone.
            expect(card('Weight').element().getAttribute('aria-busy')).toBe(
                'true'
            )
            expect(valueOf('Weight')).toBeUndefined()
            await expect.poll(() => server.countOf('tracker/events')).toBe(2)

            server.release()
            await expect.poll(() => valueOf('Weight')).toBe(weight)
        }
    )

    it("one element's bad metadata errors only its own card", async () => {
        const server = createFakeServer({
            extraDataElements: [
                {
                    id: 'nocolour001',
                    displayName: 'No colour',
                    valueType: 'NUMBER',
                    legendSets: [
                        {
                            legends: [
                                { name: 'Low', startValue: 0, endValue: 5 },
                            ],
                        },
                    ],
                },
                {
                    id: 'badlegend01',
                    displayName: 'Bad legend',
                    valueType: 'NUMBER',
                    legendSets: [{ legends: [{ name: 'Low', color: '#f00' }] }],
                },
                {
                    id: 'broken00001',
                    displayName: 'Broken',
                    valueType: 'TEXT',
                    optionSet: { options: [{ code: 'A' }] },
                },
            ],
        })
        const Wrapper = createWrapper(server.data)

        await render(
            <Wrapper>
                <ObservationsProvider trackedEntity="te1" program="prog1">
                    <ObservationCard dataElement={WEIGHT} />
                    <ObservationCard dataElement="nocolour001" />
                    <ObservationCard dataElement="badlegend01" />
                    <ObservationCard dataElement="broken00001" />
                </ObservationsProvider>
            </Wrapper>
        )

        await expect.poll(() => valueOf('Weight')).toBe('70')
        await expect
            .element(card('No colour'))
            .toHaveTextContent('Never recorded')
        await expect
            .element(card('Bad legend'))
            .toHaveTextContent('Never recorded')
        // The card shows the error state, named from the metadata.
        await expect
            .element(card('Broken'))
            .toHaveTextContent("Couldn't load this value")
    })

    it('two providers keep their series apart', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper(server.data)

        await render(
            <Wrapper>
                <ObservationsProvider trackedEntity="te1" program="prog1">
                    <ObservationCard dataElement={WEIGHT} label="First" />
                </ObservationsProvider>
                <ObservationsProvider trackedEntity="te2" program="prog1">
                    <ObservationCard dataElement={WEIGHT} label="Second" />
                </ObservationsProvider>
            </Wrapper>
        )

        await expect.poll(() => valueOf('First')).toBe('70')
        await expect.poll(() => valueOf('Second')).toBe('82')
        // The program's metadata is shared; each person's records are not.
        expect(server.countOf('programs')).toBe(1)
        expect(server.countOf('tracker/events')).toBe(2)
    })

    it('a data element outside the program is misconfigured, not empty', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper(server.data)

        await render(
            <Wrapper>
                <ObservationsProvider trackedEntity="te1" program="prog1">
                    <ObservationCard dataElement="typoDE0001" label="Typo" />
                </ObservationsProvider>
            </Wrapper>
        )

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent(
                `Data element typoDE0001 is not captured by any stage of program prog1. Captured data elements: ${WEIGHT} (Weight), ${TEMP} (Temperature), ${HEIGHT} (Height)`
            )
    })

    it.each([
        { failure: 'no visible enrollment', options: { noEnrollment: true } },
        { failure: 'a failed events request', options: { eventsFail: true } },
    ])('$failure is an error for every card', async ({ options }) => {
        const server = createFakeServer(options)
        const Wrapper = createWrapper(server.data)

        await render(
            <Wrapper>
                <ObservationsProvider trackedEntity="te1" program="prog1">
                    <ObservationCard dataElement={WEIGHT} />
                    <ObservationCard dataElement={TEMP} />
                </ObservationsProvider>
            </Wrapper>
        )

        for (const name of ['Weight', 'Temperature']) {
            await expect
                .element(card(name))
                .toHaveTextContent("Couldn't load this value")
        }
        // Neither failure is the server's or the network's, so neither is retried.
        expect(server.countOf('tracker/events')).toBe(1)
    })

    it.each([
        { trackedEntity: '', program: 'prog1' },
        { trackedEntity: 'te1', program: '' },
    ])('makes no request and stays loading for %o', async (ids) => {
        const server = createFakeServer()
        const Wrapper = createWrapper(server.data)

        await render(
            <Wrapper>
                <ObservationsProvider {...ids}>
                    <ObservationCard dataElement={WEIGHT} label="Weight" />
                </ObservationsProvider>
            </Wrapper>
        )

        // Long enough for an enabled query to have started.
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(
            server.requests.filter((resource) => resource !== 'programs')
        ).toEqual([])
        await expect
            .element(card('Weight'))
            .toHaveAttribute('aria-busy', 'true')
    })

    it('a card outside the provider throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})

        await render(
            <Catch>
                <ObservationCard dataElement={WEIGHT} />
            </Catch>
        )

        await expect
            .element(page.getByTestId('caught'))
            .toHaveTextContent(
                'Observation cards and hooks must be rendered inside ObservationsProvider'
            )
        vi.restoreAllMocks()
    })
})
