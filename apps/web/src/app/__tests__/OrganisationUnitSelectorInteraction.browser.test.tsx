import { OrganisationUnitSelector } from '@dhis2-blocks/context-selector'
import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import { OrganisationUnitSelectorContent } from '../OrganisationUnitSelectorContent'

const ROOT_ID = 'RootUnit001'
const CHILD_ID = 'ChildUnit01'
const ROOT_PATH = `/${ROOT_ID}`
const CHILD_PATH = `${ROOT_PATH}/${CHILD_ID}`

const TestOrganisationUnitTree = ({
    expanded,
    handleExpand,
    handleCollapse,
    onChange,
}: {
    expanded: string[]
    handleExpand: (payload: { path: string }) => void
    handleCollapse: (payload: { path: string }) => void
    onChange: (
        payload: {
            checked: boolean
            id: string
            displayName: string
            path: string
        },
        event: React.MouseEvent<HTMLElement>
    ) => void
}) => {
    const rootIsOpen = expanded.includes(ROOT_PATH)

    return (
        <div data-testid="test-org-unit-tree">
            <button
                aria-expanded={rootIsOpen}
                data-testid="root-toggle"
                type="button"
                onClick={() =>
                    rootIsOpen
                        ? handleCollapse({ path: ROOT_PATH })
                        : handleExpand({ path: ROOT_PATH })
                }
            >
                Root organisation unit
            </button>
            {rootIsOpen ? (
                <button
                    data-testid="child-unit"
                    type="button"
                    onClick={(event) =>
                        onChange(
                            {
                                checked: true,
                                id: CHILD_ID,
                                displayName: 'Child organisation unit',
                                path: CHILD_PATH,
                            },
                            event
                        )
                    }
                >
                    Child organisation unit
                </button>
            ) : null}
        </div>
    )
}

const Harness = () => {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState<string>()

    return (
        <OrganisationUnitSelector
            label="Organisation unit"
            value={selected}
            open={open}
            onOpenChange={setOpen}
        >
            <OrganisationUnitSelectorContent
                roots={[
                    {
                        id: ROOT_ID,
                        displayName: 'Root organisation unit',
                        path: ROOT_PATH,
                    },
                ]}
                allowedPaths={[ROOT_PATH]}
                searchValue=""
                treeKey="initial"
                treeComponent={TestOrganisationUnitTree}
                onSearchChange={() => undefined}
                onSelect={(organisationUnit) => {
                    setSelected(organisationUnit.displayName)
                    setOpen(false)
                }}
            />
        </OrganisationUnitSelector>
    )
}

describe('organisation-unit selector interaction reliability', () => {
    it('honours the first collapse, expand, and selection clicks without remounting or reopening', async () => {
        const screen = await render(<Harness />)
        await screen.getByRole('button', { name: /Organisation unit/ }).click()

        const firstToggle = screen.getByTestId('root-toggle')
        await expect
            .element(firstToggle)
            .toHaveAttribute('aria-expanded', 'true')

        const firstToggleElement = firstToggle.element()
        await firstToggle.click()
        await expect
            .element(screen.getByTestId('child-unit'))
            .not.toBeInTheDocument()
        await expect
            .element(firstToggle)
            .toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByTestId('root-toggle').element()).toBe(
            firstToggleElement
        )

        await firstToggle.click()
        await expect.element(screen.getByTestId('child-unit')).toBeVisible()
        await expect
            .element(firstToggle)
            .toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByTestId('root-toggle').element()).toBe(
            firstToggleElement
        )

        await screen.getByTestId('child-unit').click()
        await expect
            .element(
                screen.getByRole('button', {
                    name: /Organisation unit.*Child organisation unit/,
                })
            )
            .toBeVisible()
        await expect
            .element(screen.getByTestId('test-org-unit-tree'))
            .not.toBeInTheDocument()
    })
})
