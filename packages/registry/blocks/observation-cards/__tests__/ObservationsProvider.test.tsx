import React, { type ErrorInfo, type ReactNode } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ObservationCard } from '../card/ObservationCard'
import { ObservationsProvider } from '../provider/ObservationsProvider'
import {
    createFakeServer,
    createWrapper,
    HEIGHT,
    Probe,
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

describe('ObservationsProvider', () => {
    it('one metadata, one enrollment and one events request for any number of cards', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="weight" dataElement={WEIGHT} />
                    <Probe id="temp" dataElement={TEMP} />
                    <Probe id="height" dataElement={HEIGHT} />
                </ObservationsProvider>
            </Wrapper>
        )

        await expect
            .element(page.getByTestId('weight'))
            .toHaveTextContent('ready 70')
        await expect
            .element(page.getByTestId('temp'))
            .toHaveTextContent('ready none')
        await expect
            .element(page.getByTestId('height'))
            .toHaveTextContent('ready none')
        expect(server.countOf('programs')).toBe(1)
        expect(server.countOf('tracker/enrollments')).toBe(1)
        expect(server.countOf('tracker/events')).toBe(1)
        expect(server.requests).toHaveLength(3)
    })

    it("switching trackedEntity shows pending before the new person's series", async () => {
        const server = createFakeServer({ deferEventsFor: 'te2' })
        const Wrapper = createWrapper()
        const seen: string[] = []
        const ui = (trackedEntity: string) => (
            <Wrapper>
                <ObservationsProvider
                    trackedEntity={trackedEntity}
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="weight" dataElement={WEIGHT} seen={seen} />
                </ObservationsProvider>
            </Wrapper>
        )

        const screen = await render(ui('te1'))
        await expect
            .element(page.getByTestId('weight'))
            .toHaveTextContent('ready 70')

        const before = seen.length
        await screen.rerender(ui('te2'))
        await expect
            .element(page.getByTestId('weight'))
            .toHaveTextContent('pending')
        await expect.poll(() => server.countOf('tracker/events')).toBe(2)

        // Every render since the switch, not only the last one.
        expect(seen.slice(before)).not.toContain('ready 70')
        expect(seen.slice(before).every((state) => state === 'pending')).toBe(
            true
        )

        server.release()
        await expect
            .element(page.getByTestId('weight'))
            .toHaveTextContent('ready 82')
        expect(seen.slice(before)).not.toContain('ready 70')
    })

    it("switching program shows pending before the new program's series", async () => {
        const server = createFakeServer({ deferEventsFor: 'prog2' })
        const Wrapper = createWrapper()
        const seen: string[] = []
        const ui = (program: string) => (
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program={program}
                    client={server.client}
                >
                    <Probe id="weight" dataElement={WEIGHT} seen={seen} />
                </ObservationsProvider>
            </Wrapper>
        )

        const screen = await render(ui('prog1'))
        await expect
            .element(page.getByTestId('weight'))
            .toHaveTextContent('ready 70')

        const before = seen.length
        await screen.rerender(ui('prog2'))
        await expect
            .element(page.getByTestId('weight'))
            .toHaveTextContent('pending')
        await expect.poll(() => server.countOf('tracker/events')).toBe(2)

        // Every render since the switch, not only the last one.
        expect(seen.slice(before)).not.toContain('ready 70')
        expect(seen.slice(before).every((state) => state === 'pending')).toBe(
            true
        )

        server.release()
        await expect
            .element(page.getByTestId('weight'))
            .toHaveTextContent('ready 64')
        expect(seen.slice(before)).not.toContain('ready 70')
    })

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
        const Wrapper = createWrapper()

        const { container } = await render(
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="weight" dataElement={WEIGHT} />
                    <Probe id="nocolour" dataElement="nocolour001" />
                    <Probe id="badlegend" dataElement="badlegend01" />
                    <Probe id="broken" dataElement="broken00001" />
                    <ObservationCard dataElement="broken00001" />
                </ObservationsProvider>
            </Wrapper>
        )

        await expect
            .element(page.getByTestId('weight'))
            .toHaveTextContent('ready 70')
        await expect
            .element(page.getByTestId('nocolour'))
            .toHaveTextContent('ready none')
        await expect
            .element(page.getByTestId('badlegend'))
            .toHaveTextContent('ready none')
        await expect
            .element(page.getByTestId('broken'))
            .toHaveTextContent(
                "error Data element broken00001 has metadata this card can't read"
            )
        // The card shows the error state, named from the metadata.
        await expect
            .element(page.getByText("Couldn't load this value"))
            .toBeVisible()
        expect(
            container
                .querySelector('[data-slot="observation-card"]')
                ?.getAttribute('aria-label')
        ).toBe('Broken')
    })

    it('two providers keep their series apart', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="first" dataElement={WEIGHT} />
                </ObservationsProvider>
                <ObservationsProvider
                    trackedEntity="te2"
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="second" dataElement={WEIGHT} />
                </ObservationsProvider>
            </Wrapper>
        )

        await expect
            .element(page.getByTestId('first'))
            .toHaveTextContent('ready 70')
        await expect
            .element(page.getByTestId('second'))
            .toHaveTextContent('ready 82')
        // The program's metadata is shared; each person's records are not.
        expect(server.countOf('programs')).toBe(1)
        expect(server.countOf('tracker/events')).toBe(2)
    })

    it('a data element outside the program is misconfigured, not empty', async () => {
        const server = createFakeServer()
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="typo" dataElement="typoDE0001" />
                </ObservationsProvider>
            </Wrapper>
        )

        await expect
            .element(page.getByTestId('typo'))
            .toHaveTextContent(
                `misconfigured Data element typoDE0001 is not captured by any stage of program prog1. Captured data elements: ${WEIGHT} (Weight), ${TEMP} (Temperature), ${HEIGHT} (Height)`
            )
    })

    it('no visible enrollment is an error for every card', async () => {
        const server = createFakeServer({ noEnrollment: true })
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="weight" dataElement={WEIGHT} />
                    <Probe id="temp" dataElement={TEMP} />
                </ObservationsProvider>
            </Wrapper>
        )

        for (const id of ['weight', 'temp']) {
            await expect
                .element(page.getByTestId(id))
                .toHaveTextContent(
                    'error This person has no visible enrollment in this program'
                )
        }
    })

    it('a failed events request is an error for every card', async () => {
        const server = createFakeServer({ eventsFail: true })
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="weight" dataElement={WEIGHT} />
                    <Probe id="temp" dataElement={TEMP} />
                </ObservationsProvider>
            </Wrapper>
        )

        for (const id of ['weight', 'temp']) {
            await expect
                .element(page.getByTestId(id))
                .toHaveTextContent(/^error .*boom/)
        }
    })

    it.each([
        { trackedEntity: '', program: 'prog1' },
        { trackedEntity: '   ', program: 'prog1' },
        { trackedEntity: 'te1', program: '' },
    ])('makes no request and stays pending for %o', async (ids) => {
        const server = createFakeServer()
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <ObservationsProvider {...ids} client={server.client}>
                    <Probe id="weight" dataElement={WEIGHT} />
                </ObservationsProvider>
            </Wrapper>
        )

        // Long enough for an enabled query to have started.
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(server.requests).toEqual([])
        await expect
            .element(page.getByTestId('weight'))
            .toHaveTextContent('pending')
    })

    it('useObservation outside the provider throws', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})

        await render(
            <Catch>
                <Probe id="weight" dataElement={WEIGHT} />
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
