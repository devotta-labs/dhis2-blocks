import React from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { render } from 'vitest-browser-react'
import { useAppUrlState } from '../useAppUrlState'

const UrlStateHarness = () => {
    const [state, update] = useAppUrlState()

    return (
        <>
            <output data-testid="url-state">{JSON.stringify(state)}</output>
            <button
                onClick={() => {
                    update((current) => ({ ...current, page: 1, pageSize: 25 }))
                    update((current) => ({
                        ...current,
                        selectedTemplateId: 'default',
                    }))
                }}
            >
                Change view
            </button>
            <button
                onClick={() => update((current) => ({ ...current, page: 3 }))}
            >
                Next page
            </button>
        </>
    )
}

describe('Working List URL state', () => {
    it('composes callbacks into one history entry and preserves Back/Forward state', async () => {
        const initial =
            '/?programId=program&selectedTemplateId=saved&page=2&pageSize=15'

        const router = createMemoryRouter(
            [{ path: '/', element: <UrlStateHarness /> }],
            { initialEntries: [initial] }
        )

        const screen = await render(<RouterProvider router={router} />)

        await screen.getByRole('button', { name: 'Change view' }).click()
        await expect.element(screen.getByTestId('url-state')).toHaveTextContent(
            JSON.stringify({
                programId: 'program',
                selectedTemplateId: 'default',
                page: 1,
                pageSize: 25,
            })
        )
        const changed = router.state.location.search

        await router.navigate(-1)
        await expect.element(screen.getByTestId('url-state')).toHaveTextContent(
            JSON.stringify({
                programId: 'program',
                selectedTemplateId: 'saved',
                page: 2,
                pageSize: 15,
            })
        )
        expect(router.state.location.search).toBe(initial.slice(1))

        await router.navigate(1)
        await expect.element(screen.getByTestId('url-state')).toHaveTextContent(
            JSON.stringify({
                programId: 'program',
                selectedTemplateId: 'default',
                page: 1,
                pageSize: 25,
            })
        )
        expect(router.state.location.search).toBe(changed)

        await screen.getByRole('button', { name: 'Next page' }).click()
        await expect.element(screen.getByTestId('url-state')).toHaveTextContent(
            JSON.stringify({
                programId: 'program',
                selectedTemplateId: 'default',
                page: 3,
                pageSize: 25,
            })
        )
        await router.navigate(-1)
        await expect.element(screen.getByTestId('url-state')).toHaveTextContent(
            JSON.stringify({
                programId: 'program',
                selectedTemplateId: 'default',
                page: 1,
                pageSize: 25,
            })
        )

        await screen.unmount()
        router.dispose()
    })
})
