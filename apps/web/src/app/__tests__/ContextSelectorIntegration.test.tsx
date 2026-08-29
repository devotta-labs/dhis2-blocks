import {
    ContextOrganisationUnitSelector,
    ContextProgramSelector,
    ContextSelector,
} from '@dhis2-blocks/context-selector'
import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import { DiscardChangesDialog } from '../DiscardChangesDialog'

const ContextSelectorHarness = () => {
    const [programOpen, setProgramOpen] = useState(false)
    const [organisationUnitOpen, setOrganisationUnitOpen] = useState(false)
    const [program, setProgram] = useState<string>()
    const [organisationUnit, setOrganisationUnit] = useState<string>()

    return (
        <ContextSelector ariaLabel="Working list context">
            <ContextProgramSelector
                options={[
                    {
                        value: 'Program0001',
                        label: 'Child Programme',
                    },
                ]}
                selectedValue={program}
                control={{
                    mode: 'interactive',
                    open: programOpen,
                    onOpenChange: setProgramOpen,
                    onSelect: (value) => {
                        setProgram(value)
                        setProgramOpen(false)
                    },
                }}
            />
            {program && (
                <ContextOrganisationUnitSelector
                    value={organisationUnit}
                    control={{
                        mode: 'interactive',
                        open: organisationUnitOpen,
                        onOpenChange: setOrganisationUnitOpen,
                    }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            setOrganisationUnit('Ngelehun CHC')
                            setOrganisationUnitOpen(false)
                        }}
                    >
                        Select Ngelehun CHC
                    </button>
                </ContextOrganisationUnitSelector>
            )}
        </ContextSelector>
    )
}

const DirtyTransitionHarness = () => {
    const [programOpen, setProgramOpen] = useState(false)
    const [program, setProgram] = useState('Program0001')
    const [dirty, setDirty] = useState(true)
    const [pendingProgram, setPendingProgram] = useState<string>()

    return (
        <>
            <ContextSelector ariaLabel="Working list context">
                <ContextProgramSelector
                    options={[
                        { value: 'Program0001', label: 'Program A' },
                        { value: 'Program0002', label: 'Program B' },
                    ]}
                    selectedValue={program}
                    control={{
                        mode: 'interactive',
                        open: programOpen,
                        onOpenChange: setProgramOpen,
                        onSelect: (value) => {
                            if (dirty) {
                                setPendingProgram(value)
                            } else {
                                setProgram(value)
                            }
                        },
                    }}
                />
            </ContextSelector>
            <DiscardChangesDialog
                open={Boolean(pendingProgram)}
                onCancel={() => setPendingProgram(undefined)}
                onDiscard={() => {
                    setDirty(false)
                    setProgram(pendingProgram!)
                    setPendingProgram(undefined)
                }}
            />
        </>
    )
}

describe('working-list context-selector integration', () => {
    it('lets the host progressively disclose and commit context controls', async () => {
        const screen = await render(<ContextSelectorHarness />)

        await expect
            .element(
                screen.getByRole('navigation', {
                    name: 'Working list context',
                })
            )
            .toBeVisible()
        expect(
            screen.container.querySelector(
                '[data-test="org-unit-selector-container"]'
            )
        ).toBeNull()

        await screen.getByRole('button', { name: /Program/ }).click()
        await screen.getByText('Child Programme').click()

        const organisationUnitSelector = screen.getByRole('button', {
            name: /Organisation unit/,
        })
        await expect.element(organisationUnitSelector).toBeVisible()
        await organisationUnitSelector.click()
        await screen
            .getByRole('button', {
                name: 'Select Ngelehun CHC',
            })
            .click()

        await expect
            .element(
                screen.getByRole('button', {
                    name: /Organisation unit.*Ngelehun CHC/,
                })
            )
            .toBeVisible()
    })

    it('cancels or commits a dirty context transition through the Capture dialog', async () => {
        const screen = await render(<DirtyTransitionHarness />)

        await screen.getByRole('button', { name: /Program.*Program A/ }).click()
        await screen.getByText('Program B').click()
        await expect
            .element(
                screen.getByRole('heading', {
                    name: 'Discard unsaved changes?',
                })
            )
            .toBeVisible()
        await screen.getByRole('button', { name: 'No, cancel' }).click()
        await expect
            .element(screen.getByRole('button', { name: /Program.*Program A/ }))
            .toBeVisible()

        await screen.getByRole('button', { name: /Program.*Program A/ }).click()
        await screen.getByText('Program B').click()
        await screen
            .getByRole('button', { name: 'Yes, discard changes' })
            .click()
        await expect
            .element(screen.getByRole('button', { name: /Program.*Program B/ }))
            .toBeVisible()
    })
})
