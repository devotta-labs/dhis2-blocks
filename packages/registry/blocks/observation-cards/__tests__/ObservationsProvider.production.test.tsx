import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ObservationsProvider } from '../provider/ObservationsProvider'
import {
    createFakeServer,
    createWrapper,
    HEIGHT,
    Probe,
    TEMP,
    WEIGHT,
} from './observationsTestSupport'

// Runs in the `browser-production` project, built with
// `process.env.NODE_ENV` set to "production" as an app's production build is.

const message = `Data element typoDE0001 is not captured by any stage of program prog1. Captured data elements: ${WEIGHT} (Weight), ${TEMP} (Temperature), ${HEIGHT} (Height)`

describe('a misconfigured data element in production', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('logs the full message once per provider', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
        const server = createFakeServer()
        const Wrapper = createWrapper()

        await render(
            <Wrapper>
                <ObservationsProvider
                    trackedEntity="te1"
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="first" dataElement="typoDE0001" />
                    <Probe id="second" dataElement="typoDE0001" />
                </ObservationsProvider>
                <ObservationsProvider
                    trackedEntity="te2"
                    program="prog1"
                    client={server.client}
                >
                    <Probe id="other" dataElement="typoDE0001" />
                </ObservationsProvider>
            </Wrapper>
        )

        // The state keeps the full message; the card decides what to show.
        await expect
            .element(page.getByTestId('first'))
            .toHaveTextContent(`misconfigured ${message}`)
        await expect
            .element(page.getByTestId('other'))
            .toHaveTextContent(`misconfigured ${message}`)
        await expect
            .poll(() => errors.mock.calls)
            .toEqual([[message], [message]])
    })
})
