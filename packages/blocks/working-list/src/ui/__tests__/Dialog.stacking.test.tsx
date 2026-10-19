import React, { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    ComboboxField,
    SelectField,
} from '../FilterControls/FilterSelectFields'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/registry/dhis2/ui/alert-dialog'
import { Button } from '@/registry/dhis2/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/registry/dhis2/ui/dialog'
import { WorkingListTextProvider } from '../WorkingListText'

/** True when `element` is what a click at its centre would actually hit. */
const paintsOnTop = (element: Element) => {
    const { left, top, width, height } = element.getBoundingClientRect()
    const hit = document.elementFromPoint(left + width / 2, top + height / 2)
    return hit !== null && (hit === element || element.contains(hit))
}

const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
]

const FormDialog = ({
    onOpenChange,
}: {
    onOpenChange: (open: boolean) => void
}) => {
    const [single, setSingle] = useState<string>('a')
    const [multiple, setMultiple] = useState<string[]>([])
    return (
        <WorkingListTextProvider translate={(message) => message}>
            <Dialog open onOpenChange={onOpenChange}>
                <DialogContent size="sm" position="middle">
                    <DialogHeader>
                        <DialogTitle>Edit</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <SelectField
                            label="Single"
                            value={single}
                            options={options}
                            onChange={setSingle}
                        />
                        <ComboboxField
                            multiple
                            label="Multiple"
                            values={multiple}
                            options={options}
                            noMatchText="No match"
                            onChange={setMultiple}
                        />
                    </div>
                    <DialogFooter>
                        <Button>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </WorkingListTextProvider>
    )
}

describe('dialog stacking', () => {
    it('keeps selects opened inside a dialog above it without dismissing it', async () => {
        const onOpenChange = vi.fn()
        await render(<FormDialog onOpenChange={onOpenChange} />)
        const dialog = page.getByRole('dialog', { name: 'Edit' })
        await expect.element(dialog).toBeVisible()

        await dialog.getByRole('combobox', { name: 'Single' }).click()
        const beta = page.getByRole('option', { name: 'Beta' })
        await expect.element(beta).toBeVisible()
        expect(paintsOnTop(beta.element())).toBe(true)
        await beta.click()
        await expect
            .element(dialog.getByRole('combobox', { name: 'Single' }))
            .toHaveTextContent('Beta')

        await dialog.getByRole('combobox', { name: 'Multiple' }).click()
        const alpha = page.getByRole('option', { name: 'Alpha' })
        expect(paintsOnTop(alpha.element())).toBe(true)
        await alpha.click()
        await userEvent.keyboard('{Escape}')

        await expect.element(dialog).toBeVisible()
        await expect.element(dialog).toHaveTextContent('Alpha')
        expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('closes a dialog on Escape, a backdrop press and its close button', async () => {
        const onOpenChange = vi.fn()
        await render(
            <Dialog open onOpenChange={onOpenChange}>
                <DialogContent closeLabel="Close dialog">
                    <DialogTitle>Details</DialogTitle>
                </DialogContent>
            </Dialog>
        )
        await expect
            .element(page.getByRole('dialog', { name: 'Details' }))
            .toBeVisible()

        await userEvent.keyboard('{Escape}')
        await page.getByRole('button', { name: 'Close dialog' }).click()
        await userEvent.click(document.body, { position: { x: 5, y: 5 } })

        expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([
            false,
            false,
            false,
        ])
    })

    it('keeps an alert dialog open on a backdrop press', async () => {
        const onOpenChange = vi.fn()
        await render(
            <AlertDialog open onOpenChange={onOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete view?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )
        await expect
            .element(page.getByRole('alertdialog', { name: 'Delete view?' }))
            .toBeVisible()

        await userEvent.click(document.body, { position: { x: 5, y: 5 } })
        expect(onOpenChange).not.toHaveBeenCalled()

        await page.getByRole('button', { name: 'Cancel' }).click()
        expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
    })
})
