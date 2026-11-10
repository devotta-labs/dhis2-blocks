import { Button } from '@/components/dhis2/ui/button'
import React, { type ReactNode } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    TrackedEntityActions,
    TrackedEntityAttribute,
    TrackedEntityBorn,
    TrackedEntityDetails,
    TrackedEntityEnrollment,
    TrackedEntityFacts,
    TrackedEntityHeaderProvider,
    TrackedEntityName,
    TrackedEntityOwner,
    TrackedEntityStatus,
    useTrackedEntityHeader,
} from '..'
import { createFakeServer, createWrapper, RMNCH } from './headerTestSupport'
import {
    ALLERGIES,
    BIRTH_DATE,
    FIRST,
    LAST,
    renderParts,
    type Status,
} from './valuePartsSupport'

/** The host's own whole-record view, from the hook alone. */
const QuickLookStatus = ({ status }: { status: string }) => {
    const { retry } = useTrackedEntityHeader()
    return (
        <>
            <p data-testid="host-status">{status}</p>
            <Button onClick={retry}>Try again</Button>
        </>
    )
}

/** The spec's quick look: no frame, the host's own layout. */
const QuickLook = () => {
    const { status } = useTrackedEntityHeader()
    if (status !== 'ready') {
        return <QuickLookStatus status={status} />
    }
    return (
        <>
            <TrackedEntityName
                id="quick-look-name"
                attributes={[FIRST, LAST]}
            />
            <TrackedEntityStatus />
            <TrackedEntityBorn attribute={BIRTH_DATE} />
            <TrackedEntityFacts>
                <TrackedEntityAttribute attribute={ALLERGIES} />
            </TrackedEntityFacts>
        </>
    )
}

/** The status as an attribute, so the tests can wait for it without adding text. */
const StatusMark = () => {
    const { status } = useTrackedEntityHeader()
    return <span data-testid="status" data-status={status} />
}

/** Every value part placed with no status check by the host. */
const Ungated = () => (
    <>
        <StatusMark />
        <TrackedEntityName attributes={[FIRST, LAST]} />
        <TrackedEntityStatus />
        <TrackedEntityBorn attribute={BIRTH_DATE} />
        <TrackedEntityAttribute attribute="lZGmxYbs97q" />
        <TrackedEntityOwner />
        <TrackedEntityEnrollment />
        <TrackedEntityFacts>
            <TrackedEntityAttribute attribute={ALLERGIES} />
        </TrackedEntityFacts>
        <TrackedEntityActions>
            <Button>Request access</Button>
        </TrackedEntityActions>
        <TrackedEntityDetails />
    </>
)

const VALUES = ['Linda', 'Bailey', '9411202', 'Penicillin', '1992']

const expectNoValues = (container: HTMLElement) => {
    const text = container.textContent ?? ''
    for (const value of [...VALUES, 'Not recorded', 'Unavailable']) {
        expect(text).not.toContain(value)
    }
}

const NOT_READY: Status[] = ['loading', 'failed', 'restricted']

describe('parts outside a frame', () => {
    it.each(NOT_READY)(
        'the quick look shows the host status and no value while %s',
        async (status) => {
            const screen = await renderParts(<QuickLook />, { status })

            await expect
                .element(page.getByTestId('host-status'))
                .toHaveTextContent(status)
            expectNoValues(screen.container)
        }
    )

    it.each(NOT_READY)(
        'ungated parts show no value while %s, and the actions still render',
        async (status) => {
            const screen = await renderParts(<Ungated />, { status })

            await expect
                .element(page.getByTestId('status'))
                .toHaveAttribute('data-status', status)
            await expect
                .element(page.getByRole('button', { name: 'Request access' }))
                .toBeVisible()
            expect(screen.container.textContent).toBe('Request access')
            expectNoValues(screen.container)
            expect(
                screen.container.querySelector('dl, h2, [data-slot="badge"]')
            ).toBeNull()
        }
    )

    it('status and retry drive the host view to ready', async () => {
        const server = createFakeServer({ fail: 500 })
        const Wrapper = createWrapper()
        await render(
            <Wrapper>
                <TrackedEntityHeaderProvider
                    trackedEntity="te1"
                    program={RMNCH}
                    client={server.client}
                >
                    <QuickLook />
                </TrackedEntityHeaderProvider>
            </Wrapper>
        )

        await expect
            .element(page.getByTestId('host-status'))
            .toHaveTextContent('failed')
        server.recover()
        await page.getByRole('button', { name: 'Try again' }).click()

        await expect
            .element(page.getByRole('heading', { name: 'Linda Bailey' }))
            .toBeVisible()
    })

    it("the host's dialog takes its name from the name part's id", async () => {
        const Dialog = ({ children }: { children: ReactNode }) => (
            <div role="dialog" aria-labelledby="quick-look-name">
                {children}
            </div>
        )
        await renderParts(
            <Dialog>
                <QuickLook />
            </Dialog>
        )

        await expect
            .element(page.getByRole('dialog', { name: 'Linda Bailey' }))
            .toBeVisible()
        expect(
            page.getByRole('heading', { name: 'Linda Bailey' }).element().id
        ).toBe('quick-look-name')
    })
})
