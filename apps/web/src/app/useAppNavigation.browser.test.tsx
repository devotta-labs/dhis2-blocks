import React, { act } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { render } from 'vitest-browser-react'
import { DiscardChangesDialog } from './DiscardChangesDialog'
import { SyncUrlWithGlobalShell } from './SyncUrlWithGlobalShell'
import { useAppNavigation } from './useAppNavigation'
import { useAppUrlState } from './useAppUrlState'
import { getOrganisationUnitState, getProgramState } from './contextTransitions'

const Harness = () => {
    const [state, setState] = useAppUrlState()
    const navigation = useAppNavigation()
    return (
        <>
            <output aria-label="Context">{JSON.stringify(state)}</output>
            <output aria-label="Record">
                {navigation.openedRecord?.trackedEntityId}
            </output>
            <button onClick={() => navigation.setDirty(true)}>Edit</button>
            <button
                onClick={() =>
                    navigation.setOpenedRecord({
                        mode: 'trackedEntity',
                        programId: 'a',
                        trackedEntityId: 'record',
                    })
                }
            >
                Open record
            </button>
            <button
                onClick={() =>
                    navigation.requestTransition(() =>
                        setState(getProgramState(state, 'b'))
                    )
                }
            >
                Program B
            </button>
            <button
                data-testid="request-c"
                onClick={() =>
                    navigation.requestTransition(() =>
                        setState(getProgramState(state, 'c'))
                    )
                }
            >
                Program C
            </button>
            <button
                onClick={() =>
                    navigation.requestTransition(() =>
                        setState(getOrganisationUnitState(state, 'ou2'))
                    )
                }
            >
                OU 2
            </button>
            <DiscardChangesDialog
                open={navigation.confirmationOpen}
                onCancel={navigation.cancelTransition}
                onDiscard={navigation.confirmTransition}
            />
        </>
    )
}

const setup = async (
    entries = ['/?programId=a', '/?programId=b'],
    index = entries.length - 1
) => {
    const router = createMemoryRouter(
        [
            {
                path: '/',
                element: (
                    <SyncUrlWithGlobalShell>
                        <Harness />
                    </SyncUrlWithGlobalShell>
                ),
            },
        ],
        { initialEntries: entries, initialIndex: index }
    )
    const screen = await render(<RouterProvider router={router} />)
    return { router, screen }
}

const unloadIsBlocked = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
}

describe('app navigation with the data router', () => {
    it.each([-1, 1])(
        'cancels and retries a dirty POP (%s) with one confirmation',
        async (direction) => {
            const { screen, router } = await setup(
                undefined,
                direction === -1 ? 1 : 0
            )
            const current = router.state.location.search
            await screen
                .getByRole('button', { name: 'Edit', exact: true })
                .click()
            await screen.getByRole('button', { name: 'Open record' }).click()
            const committed: string[] = []
            const onPop = () => committed.push(router.state.location.search)
            window.addEventListener('popstate', onPop)
            try {
                await act(() => router.navigate(direction))
                await expect
                    .element(
                        screen.getByRole('heading', {
                            name: 'Discard unsaved changes?',
                        })
                    )
                    .toBeVisible()
                expect(router.state.location.search).toBe(current)
                expect(committed).toEqual([])
                await expect
                    .element(screen.getByLabelText('Record'))
                    .toHaveTextContent('record')
                await screen.getByRole('button', { name: 'No, cancel' }).click()
                expect(router.state.location.search).toBe(current)
                expect(unloadIsBlocked()).toBe(true)
                await act(() => router.navigate(direction))
                await screen
                    .getByRole('button', { name: 'Yes, discard changes' })
                    .click()
                expect(router.state.location.search).not.toBe(current)
                expect(committed).toEqual([router.state.location.search])
                await expect
                    .element(screen.getByLabelText('Record'))
                    .toHaveTextContent('')
                await expect
                    .element(
                        screen.getByRole('heading', {
                            name: 'Discard unsaved changes?',
                        })
                    )
                    .not.toBeInTheDocument()
                expect(unloadIsBlocked()).toBe(false)
            } finally {
                window.removeEventListener('popstate', onPop)
                router.dispose()
            }
        }
    )

    it('keeps the latest in-app request and closes the record only when committed', async () => {
        const { screen, router } = await setup(['/?programId=a&orgUnitId=ou1'])
        await screen.getByRole('button', { name: 'Edit', exact: true }).click()
        await screen.getByRole('button', { name: 'Open record' }).click()
        await screen.getByRole('button', { name: 'Program B' }).click()
        await act(() =>
            screen
                .getByTestId('request-c')
                .element()
                .dispatchEvent(new MouseEvent('click', { bubbles: true }))
        )
        expect(router.state.location.search).toBe('?programId=a&orgUnitId=ou1')
        await expect
            .element(screen.getByLabelText('Record'))
            .toHaveTextContent('record')
        await screen
            .getByRole('button', { name: 'Yes, discard changes' })
            .click()
        expect(router.state.location.search).toContain('programId=c')
        await expect
            .element(screen.getByLabelText('Record'))
            .toHaveTextContent('')
        expect(unloadIsBlocked()).toBe(false)
        router.dispose()
    })

    it('replaces a blocked POP with the latest in-app request without leaving a blocker', async () => {
        const { screen, router } = await setup()
        await screen.getByRole('button', { name: 'Edit', exact: true }).click()
        await act(() => router.navigate(-1))
        await act(() =>
            screen
                .getByTestId('request-c')
                .element()
                .dispatchEvent(new MouseEvent('click', { bubbles: true }))
        )
        await screen
            .getByRole('button', { name: 'Yes, discard changes' })
            .click()
        expect(router.state.location.search).toContain('programId=c')
        await act(() => router.navigate(-1))
        expect(router.state.location.search).toBe('?programId=b')
        router.dispose()
    })

    it('replaces a pending in-app request with the latest POP destination', async () => {
        const { screen, router } = await setup([
            '/?programId=a',
            '/?programId=b',
            '/?programId=c',
        ])
        await screen.getByRole('button', { name: 'Edit', exact: true }).click()
        await screen.getByRole('button', { name: 'Program B' }).click()
        await act(() => router.navigate(-1))
        await act(() => router.navigate(-2))
        expect(router.state.location.search).toBe('?programId=c')
        await screen
            .getByRole('button', { name: 'Yes, discard changes' })
            .click()
        expect(router.state.location.search).toBe('?programId=a')
        await expect
            .element(
                screen.getByRole('heading', {
                    name: 'Discard unsaved changes?',
                })
            )
            .not.toBeInTheDocument()
        router.dispose()
    })

    it('does not guard clean navigation or dirty POP changes limited to OU/page/size', async () => {
        const { screen, router } = await setup([
            '/?programId=a&orgUnitId=ou1',
            '/?programId=a&orgUnitId=ou2&page=2&pageSize=50',
        ])
        await screen.getByRole('button', { name: 'Edit', exact: true }).click()
        await act(() => router.navigate(-1))
        expect(router.state.location.search).toBe('?programId=a&orgUnitId=ou1')
        await expect
            .element(
                screen.getByRole('heading', {
                    name: 'Discard unsaved changes?',
                })
            )
            .not.toBeInTheDocument()
        await screen.getByRole('button', { name: 'OU 2' }).click()
        await screen.getByRole('button', { name: 'No, cancel' }).click()
        expect(router.state.location.search).toBe('?programId=a&orgUnitId=ou1')
        await screen.getByRole('button', { name: 'OU 2' }).click()
        await screen
            .getByRole('button', { name: 'Yes, discard changes' })
            .click()
        await screen.getByRole('button', { name: 'Program C' }).click()
        expect(router.state.location.search).toContain('programId=c')
        router.dispose()
    })

    it('removes the unload listener when unmounted while dirty', async () => {
        const { screen, router } = await setup()
        await screen.getByRole('button', { name: 'Edit', exact: true }).click()
        expect(unloadIsBlocked()).toBe(true)
        await screen.unmount()
        expect(unloadIsBlocked()).toBe(false)
        router.dispose()
    })
})
