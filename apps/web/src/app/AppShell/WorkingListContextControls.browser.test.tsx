import React from 'react'
import { vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { WorkingListContextControls } from './WorkingListContextControls'

const renderControls = async ({
    programOptions,
    programAvailability,
    onShowAllPrograms,
    clearDisabled = true,
    onClear = () => undefined,
}: {
    programOptions: Array<{ value: string; label: string }>
    programAvailability: 'empty' | 'filtered' | 'all'
    onShowAllPrograms: () => void
    clearDisabled?: boolean
    onClear?: () => void
}) =>
    render(
        <WorkingListContextControls
            onClear={onClear}
            clearDisabled={clearDisabled}
            programOptions={programOptions}
            programOpen
            onProgramOpenChange={() => undefined}
            onProgramChange={() => undefined}
            onProgramClear={() => undefined}
            programLoading={false}
            programLoadingLabel="Loading tracker programs…"
            programAvailability={programAvailability}
            onShowAllPrograms={onShowAllPrograms}
            showOrganisationUnit={false}
            organisationUnitOpen={false}
            onOrganisationUnitOpenChange={() => undefined}
            onOrganisationUnitClear={() => undefined}
            organisationUnitLoading={false}
            organisationUnitDisabled
            organisationUnitContent={null}
        />
    )

describe('WorkingListContextControls program scope actions', () => {
    it('offers to clear the organisation unit when no program is compatible', async () => {
        const onShowAllPrograms = vi.fn()
        const screen = await renderControls({
            programOptions: [],
            programAvailability: 'empty',
            onShowAllPrograms,
        })

        await expect
            .element(screen.getByText('No programs available.'))
            .toBeVisible()
        await screen.getByRole('button', { name: 'Show all' }).click()
        expect(onShowAllPrograms).toHaveBeenCalledOnce()
    })

    it('explains partial filtering and offers the Capture show-all action', async () => {
        const onShowAllPrograms = vi.fn()
        const screen = await renderControls({
            programOptions: [{ value: 'program-a', label: 'Program A' }],
            programAvailability: 'filtered',
            onShowAllPrograms,
        })

        await expect
            .element(
                screen.getByText(
                    'Some programs are being filtered by the chosen organisation unit'
                )
            )
            .toBeVisible()
        await screen.getByRole('button', { name: 'Show all programs' }).click()
        expect(onShowAllPrograms).toHaveBeenCalledOnce()
    })

    it('keeps clear-all enabled when only the hidden organisation-unit context remains', async () => {
        const onClear = vi.fn()
        const screen = await renderControls({
            programOptions: [],
            programAvailability: 'empty',
            onShowAllPrograms: () => undefined,
            clearDisabled: false,
            onClear,
        })

        const clearAll = screen.getByRole('button', {
            name: 'Clear selections',
        })
        await expect.element(clearAll).toBeEnabled()
        await clearAll.click()
        expect(onClear).toHaveBeenCalledOnce()
    })
})
