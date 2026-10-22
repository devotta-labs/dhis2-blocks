import {
    ContextSelector,
    OrganisationUnitSelector,
    ProgramSelector,
} from '@/components/context-selector'
import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import { ContextStatus } from '../AppShell/ContextStatus'
import { WorkingListContextControls } from '../AppShell/WorkingListContextControls'
import { DiscardChangesDialog } from '../DiscardChangesDialog'

const ContextSelectorHarness = () => {
    const [programOpen, setProgramOpen] = useState(false)
    const [organisationUnitOpen, setOrganisationUnitOpen] = useState(false)
    const [program, setProgram] = useState<string>()
    const [organisationUnit, setOrganisationUnit] = useState<string>()

    return (
        <ContextSelector ariaLabel="Working list context">
            <ProgramSelector
                label="Program"
                placeholder="Choose a program"
                searchPlaceholder="Search for a program"
                options={[
                    {
                        value: 'Program0001',
                        label: 'Child Programme',
                    },
                ]}
                value={program}
                open={programOpen}
                onOpenChange={setProgramOpen}
                onChange={(value) => {
                    setProgram(value)
                    setProgramOpen(false)
                }}
            />
            {program && (
                <OrganisationUnitSelector
                    label="Organisation unit"
                    placeholder="Choose an organisation unit"
                    value={organisationUnit}
                    open={organisationUnitOpen}
                    onOpenChange={setOrganisationUnitOpen}
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
                </OrganisationUnitSelector>
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
                <ProgramSelector
                    label="Program"
                    placeholder="Choose a program"
                    searchPlaceholder="Search for a program"
                    options={[
                        { value: 'Program0001', label: 'Program A' },
                        { value: 'Program0002', label: 'Program B' },
                    ]}
                    value={program}
                    open={programOpen}
                    onOpenChange={setProgramOpen}
                    onChange={(value) => {
                        if (dirty) {
                            setPendingProgram(value)
                        } else {
                            setProgram(value)
                        }
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

const IncompatibleContextHarness = () => {
    const [program, setProgram] = useState<string | undefined>('Program0001')
    const [organisationUnit, setOrganisationUnit] = useState<
        string | undefined
    >('OrgUnit0001')
    const [programOpen, setProgramOpen] = useState(false)
    const programOptions = organisationUnit
        ? program
            ? [
                  {
                      value: program,
                      label: 'Incompatible program',
                      excludeFromMenu: true,
                  },
              ]
            : []
        : [{ value: 'Program0001', label: 'Incompatible program' }]

    return (
        <>
            <WorkingListContextControls
                onClear={() => {
                    setProgram(undefined)
                    setOrganisationUnit(undefined)
                }}
                clearDisabled={!program && !organisationUnit}
                programOptions={programOptions}
                programValue={program}
                programOpen={programOpen}
                onProgramOpenChange={setProgramOpen}
                onProgramChange={setProgram}
                onProgramClear={() => setProgram(undefined)}
                programLoading={false}
                programLoadingLabel="Loading programs"
                programsAreFiltered={Boolean(organisationUnit)}
                onShowAllPrograms={() => setOrganisationUnit(undefined)}
                showOrganisationUnit={Boolean(program)}
                organisationUnitValue="Incompatible OU"
                organisationUnitOpen={false}
                onOrganisationUnitOpenChange={() => undefined}
                onOrganisationUnitClear={() => setOrganisationUnit(undefined)}
                organisationUnitLoading={false}
                organisationUnitDisabled={false}
                organisationUnitContent={null}
            />
            <ContextStatus
                loading={false}
                error={undefined}
                hasProgram={Boolean(program)}
                organisationUnitId={organisationUnit}
                organisationUnitIsAllowed={false}
                onRetry={() => undefined}
                onChooseOrganisationUnit={() => undefined}
            />
            <output data-testid="committed-organisation-unit">
                {organisationUnit}
            </output>
        </>
    )
}

const DirtyOrganisationUnitHarness = () => {
    const [organisationUnitOpen, setOrganisationUnitOpen] = useState(false)
    const [organisationUnit, setOrganisationUnit] = useState('Organisation A')
    const [dirty, setDirty] = useState(true)
    const [pendingTransition, setPendingTransition] = useState<() => void>()
    const requestTransition = (proceed: () => void) => {
        if (dirty) {
            setPendingTransition(() => proceed)
        } else {
            proceed()
        }
    }

    return (
        <>
            <ContextSelector ariaLabel="Working list context">
                <OrganisationUnitSelector
                    value={organisationUnit}
                    open={organisationUnitOpen}
                    onOpenChange={setOrganisationUnitOpen}
                >
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            event.preventDefault()
                            setOrganisationUnitOpen(false)
                            requestTransition(() =>
                                setOrganisationUnit('Organisation B')
                            )
                        }}
                    >
                        Select Organisation B
                    </button>
                </OrganisationUnitSelector>
            </ContextSelector>
            <DiscardChangesDialog
                open={Boolean(pendingTransition)}
                onCancel={() => setPendingTransition(undefined)}
                onDiscard={() => {
                    setDirty(false)
                    pendingTransition?.()
                    setPendingTransition(undefined)
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

    it('ports Capture incompatible program and organisation-unit recovery', async () => {
        const screen = await render(<IncompatibleContextHarness />)

        await expect
            .element(
                screen.getByRole('button', {
                    name: /Program.*Incompatible program/,
                })
            )
            .toBeVisible()
        await expect
            .element(
                screen.getByText(
                    'Selected program is invalid for selected organisation unit'
                )
            )
            .toBeVisible()

        screen.container
            .querySelector<HTMLElement>(
                '[data-test="program-selector-container-clear-icon"]'
            )
            ?.click()
        await expect
            .element(screen.getByTestId('committed-organisation-unit'))
            .toHaveTextContent('OrgUnit0001')

        await screen.getByRole('button', { name: /Program/ }).click()
        await expect
            .element(screen.getByText('No programs available.'))
            .toBeVisible()
        await screen.getByRole('button', { name: 'Show all' }).click()
        await expect
            .element(screen.getByTestId('committed-organisation-unit'))
            .toHaveTextContent('')
        await expect
            .element(screen.getByText('Incompatible program'))
            .toBeVisible()
    })

    it('closes the OU popup before dirty confirmation and retains the old OU on cancel', async () => {
        const screen = await render(<DirtyOrganisationUnitHarness />)

        await screen
            .getByRole('button', { name: /Organisation unit.*Organisation A/ })
            .click()
        await screen
            .getByRole('button', { name: 'Select Organisation B' })
            .click()
        await expect
            .element(
                screen.getByRole('heading', {
                    name: 'Discard unsaved changes?',
                })
            )
            .toBeVisible()
        expect(
            screen
                .getByRole('button', { name: 'Select Organisation B' })
                .query()
        ).toBeNull()

        await screen.getByRole('button', { name: 'No, cancel' }).click()
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Organisation unit.*Organisation A/,
                })
            )
            .toBeVisible()
    })
})
