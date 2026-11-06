import { OrganisationUnitSelector } from '@/components/context-selector'
import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import { OrganisationUnitSelectorContent } from '../OrganisationUnitSelectorContent'

const ROOT_ID = 'RootUnit001'
const CHILD_ID = 'ChildUnit01'
const ROOT_PATH = `/${ROOT_ID}`
const CHILD_PATH = `${ROOT_PATH}/${CHILD_ID}`

const TestOrganisationUnitTree = ({
    expanded,
    selected,
    handleExpand,
    handleCollapse,
    onChange,
}: {
    expanded: string[]
    selected: string[]
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
            <output aria-label="Selection">{selected.join(',')}</output>
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
    it('renders loading, error, and ready states exclusively as search props change', async () => {
        const props = {
            roots: [],
            searchValue: '',
            treeKey: 'search',
            treeComponent: TestOrganisationUnitTree,
            onSearchChange: vi.fn(),
            onSelect: vi.fn(),
        }
        const screen = await render(
            <OrganisationUnitSelectorContent
                {...props}
                searchLoading
                searchError
            />
        )
        const loading = screen.getByRole('status', { name: 'Loading' })
        const error = screen.getByText('Could not search organisation units')
        const tree = screen.getByTestId('test-org-unit-tree')

        await expect.element(loading).toBeVisible()
        await expect.element(error).not.toBeInTheDocument()
        await expect.element(tree).not.toBeInTheDocument()

        await screen.rerender(
            <OrganisationUnitSelectorContent {...props} searchError />
        )
        await expect.element(error).toBeVisible()
        await expect.element(loading).not.toBeInTheDocument()
        await expect.element(tree).not.toBeInTheDocument()

        await screen.rerender(<OrganisationUnitSelectorContent {...props} />)
        await expect.element(tree).toBeVisible()
        await expect.element(error).not.toBeInTheDocument()
        await expect.element(loading).not.toBeInTheDocument()
    })

    it('preserves expansion, selection and focus while appending roots after a load-more error', async () => {
        const props = {
            roots: [],
            searchValue: '',
            treeKey: 'search',
            treeComponent: TestOrganisationUnitTree,
            onSearchChange: vi.fn(),
            onSelect: vi.fn(),
            onSearchLoadMore: vi.fn(),
            selected: {
                id: CHILD_ID,
                displayName: 'Child organisation unit',
                path: CHILD_PATH,
            },
        }
        const screen = await render(
            <OrganisationUnitSelectorContent
                {...props}
                searchHasMore
                searchLoadMoreError
            />
        )
        const toggle = screen.getByTestId('root-toggle')
        await toggle.click()
        await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
        const error = screen.getByText('Could not load more organisation units')
        const showMore = screen.getByRole('button', { name: 'Show more' })

        await expect.element(error).toBeVisible()
        await expect.element(showMore).not.toBeInTheDocument()
        await screen.getByRole('button', { name: 'Try again' }).click()
        expect(props.onSearchLoadMore).toHaveBeenCalledOnce()

        await screen.rerender(
            <OrganisationUnitSelectorContent
                {...props}
                searchHasMore
                searchLoadingMore
            />
        )
        await expect.element(error).not.toBeInTheDocument()
        await expect.element(showMore).toBeDisabled()

        await screen.rerender(
            <OrganisationUnitSelectorContent {...props} searchHasMore />
        )
        await expect.element(showMore).toBeEnabled()

        toggle.element().focus()
        await screen.rerender(
            <OrganisationUnitSelectorContent
                {...props}
                searchRoots={[
                    {
                        id: ROOT_ID,
                        displayName: 'Root organisation unit',
                        path: ROOT_PATH,
                    },
                    {
                        id: 'Appended001',
                        displayName: 'Appended root',
                        path: '/Appended001',
                    },
                ]}
            />
        )
        await expect.element(showMore).not.toBeInTheDocument()
        await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
        await expect.element(toggle).toHaveFocus()
        await expect
            .element(screen.getByLabelText('Selection'))
            .toHaveTextContent(CHILD_PATH)
    })

    it('honours the first collapse, expand, and selection clicks without reopening', async () => {
        const screen = await render(<Harness />)
        await screen.getByRole('button', { name: /Organisation unit/ }).click()

        const firstToggle = screen.getByTestId('root-toggle')
        await expect
            .element(firstToggle)
            .toHaveAttribute('aria-expanded', 'true')

        await firstToggle.click()
        await expect
            .element(screen.getByTestId('child-unit'))
            .not.toBeInTheDocument()
        await expect
            .element(firstToggle)
            .toHaveAttribute('aria-expanded', 'false')
        await expect.element(firstToggle).toHaveFocus()

        await firstToggle.click()
        await expect.element(screen.getByTestId('child-unit')).toBeVisible()
        await expect
            .element(firstToggle)
            .toHaveAttribute('aria-expanded', 'true')
        await expect.element(firstToggle).toHaveFocus()

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
