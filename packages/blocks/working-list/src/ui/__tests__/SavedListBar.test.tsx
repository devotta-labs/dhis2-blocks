import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { WorkingListSavedView } from '../../provider/contracts'
import { SavedListBar } from '../SavedListBar'
import { WorkingListTextProvider } from '../WorkingListText'

const generatedList: WorkingListSavedView = {
    id: 'active',
    name: 'Active enrollments',
    generated: true,
    compatible: true,
    canUpdate: false,
    canDelete: false,
    canShare: false,
}

const ownedList: WorkingListSavedView = {
    ...generatedList,
    id: 'OwnedList01',
    name: 'My working list',
    generated: false,
    canUpdate: true,
    canDelete: true,
    canShare: true,
}

const readOnlyList: WorkingListSavedView = {
    ...generatedList,
    id: 'ReadOnly01',
    name: 'Shared with me',
    generated: false,
}

interface RenderBarOptions {
    lists?: WorkingListSavedView[]
    selectedId?: string
    dirty?: boolean
    online?: boolean
    busy?: boolean
}

const renderBar = async (options: RenderBarOptions = {}) => {
    const lists = options.lists ?? [generatedList]
    const callbacks = {
        onSelect: vi.fn(),
        onUpdate: vi.fn(),
        onShare: vi.fn(),
        onDelete: vi.fn(),
    }
    const screen = await render(
        <WorkingListTextProvider
            translate={(message, values) =>
                Object.entries(values ?? {}).reduce(
                    (translated, [key, value]) =>
                        translated.replace(`{{${key}}}`, String(value)),
                    message
                )
            }
        >
            <SavedListBar
                lists={lists}
                selectedId={options.selectedId}
                dirty={options.dirty ?? false}
                online={options.online ?? true}
                busy={options.busy ?? false}
                {...callbacks}
            />
        </WorkingListTextProvider>
    )

    return { callbacks, screen }
}

const openOwnedListMenu = async (
    screen: Awaited<ReturnType<typeof render>>
) => {
    const trigger = screen.getByRole('button', {
        name: 'Actions for My working list',
    })
    await trigger.click()
    return trigger
}

describe('SavedListBar', () => {
    it('leaves section naming to its parent and keeps selection separate from view actions', async () => {
        const { callbacks, screen } = await renderBar({
            lists: [ownedList],
            selectedId: ownedList.id,
        })
        const selectButton = screen.getByRole('button', {
            name: 'My working list',
            exact: true,
        })
        await expect
            .element(selectButton)
            .toHaveAttribute('aria-current', 'true')
        expect(
            screen.container
                .querySelector('[data-testid="saved-list-bar"]')
                ?.hasAttribute('aria-label')
        ).toBe(false)
        expect(screen.container.textContent).not.toContain(
            'Saved views in this program'
        )

        await selectButton.click()
        expect(callbacks.onSelect).toHaveBeenCalledWith(ownedList)

        await openOwnedListMenu(screen)
        expect(callbacks.onSelect).toHaveBeenCalledTimes(1)
        await expect
            .element(page.getByRole('menuitem', { name: 'Manage sharing' }))
            .toBeVisible()
        await expect
            .element(page.getByRole('menuitem', { name: 'Delete view' }))
            .toBeVisible()
        expect(
            document.querySelector('[data-test="update-saved-view"]')
        ).toBeNull()
    })

    it('preserves the accessible dirty marker and offers updating only for the selected view', async () => {
        const { screen } = await renderBar({
            lists: [ownedList],
            selectedId: ownedList.id,
            dirty: true,
        })
        const indicator = screen.container.querySelector<HTMLElement>(
            '[data-testid="working-list-dirty-indicator"]'
        )
        expect(indicator?.textContent).toBe('*')
        expect(indicator?.getAttribute('aria-hidden')).toBe('true')
        expect(
            screen.container.querySelector(
                '[data-testid="working-list-dirty-label"]'
            )?.textContent
        ).toBe('Unsaved changes')

        await openOwnedListMenu(screen)
        for (const name of [
            'Save changes to this view',
            'Manage sharing',
            'Delete view',
        ]) {
            await expect
                .element(page.getByRole('menuitem', { name }))
                .toBeVisible()
        }
    })

    it('calls the update and sharing callbacks for their menu actions', async () => {
        const { callbacks, screen } = await renderBar({
            lists: [ownedList],
            selectedId: ownedList.id,
            dirty: true,
        })

        await openOwnedListMenu(screen)
        await page
            .getByRole('menuitem', { name: 'Save changes to this view' })
            .click()
        expect(callbacks.onUpdate).toHaveBeenCalledWith(ownedList)

        await openOwnedListMenu(screen)
        await page.getByRole('menuitem', { name: 'Manage sharing' }).click()
        expect(callbacks.onShare).toHaveBeenCalledWith(ownedList)
    })

    it('requires confirmation before deleting a view', async () => {
        const { callbacks, screen } = await renderBar({ lists: [ownedList] })

        await openOwnedListMenu(screen)
        await page.getByRole('menuitem', { name: 'Delete view' }).click()
        expect(callbacks.onDelete).not.toHaveBeenCalled()
        await expect
            .element(page.getByRole('heading', { name: 'Delete view?' }))
            .toBeVisible()
        await expect
            .element(
                page.getByText('“My working list” will be permanently deleted.')
            )
            .toBeVisible()

        await page.getByRole('button', { name: 'Delete', exact: true }).click()
        expect(callbacks.onDelete).toHaveBeenCalledWith(ownedList)
    })

    it('does not expose mutation menus for generated or read-only views', async () => {
        const generated = await renderBar({
            lists: [generatedList],
            selectedId: generatedList.id,
            dirty: true,
        })
        expect(
            generated.screen.container.querySelector('[data-saved-view-menu]')
        ).toBeNull()
        await generated.screen.unmount()

        const readOnly = await renderBar({ lists: [readOnlyList] })
        expect(
            readOnly.screen.container.querySelector('[data-saved-view-menu]')
        ).toBeNull()
    })

    it('keeps permitted actions visible but disabled while offline', async () => {
        const { screen } = await renderBar({
            lists: [ownedList],
            selectedId: ownedList.id,
            dirty: true,
            online: false,
        })

        await openOwnedListMenu(screen)
        for (const name of [
            'Save changes to this view',
            'Manage sharing',
            'Delete view',
        ]) {
            await expect
                .element(page.getByRole('menuitem', { name }))
                .toBeDisabled()
        }
    })
})
