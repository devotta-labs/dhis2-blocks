import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { WorkingListSavedView } from '../../provider/contracts'
import { ConfigureMenu } from '../ConfigureMenu'
import { WorkingListTextProvider } from '../WorkingListText'

const ownedList: WorkingListSavedView = {
    id: 'OwnedList01',
    name: 'My working list',
    generated: false,
    compatible: true,
    canUpdate: true,
    canDelete: true,
    canShare: true,
}

const renderMenu = async ({
    selectedView,
    dirty = false,
    online = true,
}: {
    selectedView?: WorkingListSavedView
    dirty?: boolean
    online?: boolean
}) => {
    const onDownload = vi.fn()
    const onSaveAs = vi.fn(async () => undefined)
    const onUpdate = vi.fn()
    const screen = await render(
        <WorkingListTextProvider translate={(message) => message}>
            <ConfigureMenu
                selectedView={selectedView}
                dirty={dirty}
                online={online}
                busy={false}
                createPending={false}
                onDownload={onDownload}
                onSaveAs={onSaveAs}
                onUpdate={onUpdate}
            />
        </WorkingListTextProvider>
    )

    return { screen, onDownload, onUpdate }
}

describe('working-list actions', () => {
    it.each([
        ['unselected', undefined],
        [
            'generated',
            { ...ownedList, id: 'Program0001-default', generated: true },
        ],
    ] as const)(
        'offers create and download, not update, for a %s view',
        async (_label, selectedView) => {
            const { screen, onDownload, onUpdate } = await renderMenu({
                selectedView,
                dirty: true,
            })
            const save = screen.getByRole('button', { name: 'Save view' })
            await expect.element(save).toBeVisible()

            await save.click()
            expect(
                page
                    .getByRole('menuitem', {
                        name: 'Save changes to this view',
                    })
                    .query()
            ).toBeNull()
            await expect
                .element(
                    page.getByRole('heading', {
                        name: 'Save as new working list',
                    })
                )
                .toBeVisible()
            await expect
                .element(
                    page.getByRole('button', { name: 'Save', exact: true })
                )
                .toBeDisabled()
            await page.getByRole('button', { name: 'Cancel' }).click()

            await screen.getByRole('button', { name: 'More' }).click()
            const download = page.getByRole('menuitem', {
                name: 'Download data…',
            })
            await expect.element(download).toBeVisible()
            await download.click()
            expect(onDownload).toHaveBeenCalledTimes(1)
            expect(onUpdate).not.toHaveBeenCalled()
        }
    )

    it('shows update and create-new actions for a persisted selection', async () => {
        const { screen, onUpdate } = await renderMenu({
            selectedView: ownedList,
            dirty: true,
        })

        expect(
            screen.container.querySelector('[data-test="working-list-options"]')
        ).toBeNull()
        await screen.getByRole('button', { name: 'Save view' }).click()
        const update = page.getByRole('menuitem', {
            name: 'Save changes to this view',
        })
        await expect.element(update).toBeEnabled()
        await expect
            .element(page.getByRole('menuitem', { name: 'Create new view…' }))
            .toBeVisible()
        await update.click()
        expect(onUpdate).toHaveBeenCalledOnce()
    })

    it('does not enable an update when the selected view is clean', async () => {
        const { screen, onUpdate } = await renderMenu({
            selectedView: ownedList,
        })

        await screen.getByRole('button', { name: 'Save view' }).click()
        await expect
            .element(
                page.getByRole('menuitem', {
                    name: 'Save changes to this view',
                })
            )
            .toBeDisabled()
        expect(onUpdate).not.toHaveBeenCalled()
    })
})
