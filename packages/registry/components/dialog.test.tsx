import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogTitle,
} from './alert-dialog'
import { Dialog, DialogContent, DialogTitle } from './dialog'

describe('dialog layout', () => {
    beforeEach(async () => {
        await page.viewport(1024, 768)
    })

    afterEach(async () => {
        await page.viewport(1024, 768)
    })

    it('centers the default dialog with the shadcn desktop width cap', async () => {
        await render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Export ready</DialogTitle>
                </DialogContent>
            </Dialog>
        )
        const dialog = page.getByRole('dialog', { name: 'Export ready' })

        await expect.element(dialog).toBeVisible()
        const bounds = dialog.element().getBoundingClientRect()

        expect(bounds.width).toBeCloseTo(384, 0)
        expect(bounds.x + bounds.width / 2).toBeCloseTo(innerWidth / 2, 0)
        expect(bounds.y + bounds.height / 2).toBeCloseTo(innerHeight / 2, 0)
    })

    it('leaves a one-rem gutter on small screens', async () => {
        await page.viewport(375, 812)
        await render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Mobile details</DialogTitle>
                </DialogContent>
            </Dialog>
        )
        const dialog = page.getByRole('dialog', { name: 'Mobile details' })

        await expect.element(dialog).toBeVisible()
        const bounds = dialog.element().getBoundingClientRect()

        expect(bounds.width).toBeCloseTo(343, 0)
        expect(bounds.x).toBeCloseTo(16, 0)
        expect(bounds.y + bounds.height / 2).toBeCloseTo(innerHeight / 2, 0)
    })

    it('lets className override width and placement without losing mobile gutters', async () => {
        await render(
            <Dialog open>
                <DialogContent className="top-16 translate-y-0 sm:max-w-2xl">
                    <DialogTitle>Custom layout</DialogTitle>
                </DialogContent>
            </Dialog>
        )
        const dialog = page.getByRole('dialog', { name: 'Custom layout' })

        await expect.element(dialog).toBeVisible()
        const bounds = dialog.element().getBoundingClientRect()

        expect(bounds.width).toBeCloseTo(672, 0)
        expect(bounds.top).toBeCloseTo(64, 0)
        expect(bounds.x + bounds.width / 2).toBeCloseTo(innerWidth / 2, 0)

        await page.viewport(375, 812)
        const mobileBounds = dialog.element().getBoundingClientRect()

        expect(mobileBounds.width).toBeCloseTo(343, 0)
        expect(mobileBounds.x).toBeCloseTo(16, 0)
        expect(mobileBounds.top).toBeCloseTo(64, 0)
    })

    it('preserves AlertDialog sizing and placement independently of Dialog', async () => {
        await render(
            <AlertDialog open>
                <AlertDialogContent size="default" position="top">
                    <AlertDialogTitle>Delete export?</AlertDialogTitle>
                </AlertDialogContent>
            </AlertDialog>
        )
        const dialog = page.getByRole('alertdialog', { name: 'Delete export?' })

        await expect.element(dialog).toBeVisible()
        const bounds = dialog.element().getBoundingClientRect()

        expect(bounds.width).toBeCloseTo(600, 0)
        expect(bounds.top).toBeCloseTo(64, 0)
    })
})
