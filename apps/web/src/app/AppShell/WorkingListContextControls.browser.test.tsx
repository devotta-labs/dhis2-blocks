import React from 'react'
import { vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { WorkingListContextControls } from './WorkingListContextControls'

const renderControls = async ({
    programOptions,
    programsAreFiltered,
    onShowAllPrograms,
    clearDisabled = true,
    onClear = () => undefined,
}: {
    programOptions: Array<{ value: string; label: string }>
    programsAreFiltered: boolean
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
            programsAreFiltered={programsAreFiltered}
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
            programsAreFiltered: true,
            onShowAllPrograms,
        })

        await expect
            .element(screen.getByText('No programs available.'))
            .toBeVisible()
        const warning = screen
            .getByText('No programs available.')
            .element().parentElement
        expect(getComputedStyle(warning!).display).toBe('flex')
        expect(getComputedStyle(warning!).alignItems).toBe('center')
        expect(getComputedStyle(warning!).gap).toBe('8px')
        expect(getComputedStyle(warning!).paddingTop).toBe('4px')
        expect(getComputedStyle(warning!).paddingRight).toBe('12px')
        expect(getComputedStyle(warning!).paddingBottom).toBe('4px')
        expect(getComputedStyle(warning!).paddingLeft).toBe('12px')
        expect(getComputedStyle(warning!).fontSize).toBe('14px')
        expect(getComputedStyle(warning!).color).toBe('rgb(74, 87, 104)')
        await screen.getByRole('button', { name: 'Show all' }).click()
        expect(onShowAllPrograms).toHaveBeenCalledOnce()
    })

    it('explains partial filtering and offers the Capture show-all action', async () => {
        const onShowAllPrograms = vi.fn()
        const screen = await renderControls({
            programOptions: [{ value: 'program-a', label: 'Program A' }],
            programsAreFiltered: true,
            onShowAllPrograms,
        })

        await expect
            .element(
                screen.getByText(
                    'Some programs are being filtered by the chosen organisation unit'
                )
            )
            .toBeVisible()
        const warning = screen
            .getByText(
                'Some programs are being filtered by the chosen organisation unit'
            )
            .element().parentElement
        expect(getComputedStyle(warning!).display).toBe('flex')
        expect(getComputedStyle(warning!).alignItems).toBe('center')
        expect(getComputedStyle(warning!).gap).toBe('8px')
        expect(getComputedStyle(warning!).paddingTop).toBe('4px')
        expect(getComputedStyle(warning!).paddingRight).toBe('12px')
        expect(getComputedStyle(warning!).paddingBottom).toBe('4px')
        expect(getComputedStyle(warning!).paddingLeft).toBe('12px')
        expect(getComputedStyle(warning!).fontSize).toBe('14px')
        expect(getComputedStyle(warning!).color).toBe('rgb(74, 87, 104)')
        await screen.getByRole('button', { name: 'Show all programs' }).click()
        expect(onShowAllPrograms).toHaveBeenCalledOnce()
    })

    it('keeps clear-all enabled when only the hidden organisation-unit context remains', async () => {
        const onClear = vi.fn()
        const screen = await renderControls({
            programOptions: [],
            programsAreFiltered: true,
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
