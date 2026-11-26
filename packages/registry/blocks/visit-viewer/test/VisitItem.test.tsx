import React, { useState } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    VisitItem,
    VisitItemContent,
    VisitItemHeader,
    VisitItemTitle,
    VisitItemTrigger,
    VisitList,
} from '..'

const Visit = (props: React.ComponentProps<typeof VisitItem>) => (
    <VisitList>
        <VisitItem {...props}>
            <VisitItemHeader>
                <VisitItemTitle>Child health visit</VisitItemTitle>
                <VisitItemTrigger />
            </VisitItemHeader>
            <VisitItemContent>Weight 7.4 kg</VisitItemContent>
        </VisitItem>
    </VisitList>
)

const Controlled = ({
    onOpenChange,
}: {
    onOpenChange: (open: boolean) => void
}) => {
    const [open, setOpen] = useState(false)
    return (
        <>
            <button type="button" onClick={() => setOpen(!open)}>
                Toggle from outside
            </button>
            <Visit
                open={open}
                onOpenChange={(next) => {
                    onOpenChange(next)
                    setOpen(next)
                }}
            />
        </>
    )
}

describe('visit item disclosure', () => {
    it('opens and closes its details by mouse, naming the panel it controls', async () => {
        const screen = await render(<Visit />)
        const trigger = screen.getByRole('button', { name: 'Details' })
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
        await expect
            .element(screen.getByText('Weight 7.4 kg'))
            .not.toBeInTheDocument()

        await trigger.click()
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
        const panel = screen.getByText('Weight 7.4 kg')
        await expect.element(panel).toBeVisible()
        const panelId = panel.element().id
        expect(panelId).not.toBe('')
        await expect.element(trigger).toHaveAttribute('aria-controls', panelId)
        expect(panel.element().getAttribute('data-slot')).toBe(
            'visit-item-content'
        )

        await trigger.click()
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('opens with Enter and Space from the keyboard', async () => {
        const screen = await render(<Visit />)
        const trigger = screen.getByRole('button', { name: 'Details' })
        await userEvent.tab()
        await expect.element(trigger).toHaveFocus()
        await userEvent.keyboard('{Enter}')
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
        await expect.element(screen.getByText('Weight 7.4 kg')).toBeVisible()
        await userEvent.keyboard(' ')
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('starts open with defaultOpen and turns its chevron', async () => {
        const screen = await render(<Visit defaultOpen />)
        const trigger = screen.getByRole('button', { name: 'Details' })
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
        await expect.element(trigger).toHaveAttribute('data-panel-open')
        const chevron = trigger
            .element()
            .querySelector('[data-slot="visit-item-chevron"]')
        expect(chevron === null ? '' : getComputedStyle(chevron).rotate).toBe(
            '90deg'
        )
    })

    it('follows a controlled open state and reports requests to change it', async () => {
        const onOpenChange = vi.fn()
        const screen = await render(<Controlled onOpenChange={onOpenChange} />)
        const trigger = screen.getByRole('button', { name: 'Details' })
        await screen
            .getByRole('button', { name: 'Toggle from outside' })
            .click()
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(onOpenChange).not.toHaveBeenCalled()

        await trigger.click()
        expect(onOpenChange).toHaveBeenLastCalledWith(false)
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('stays closed when its parent refuses the change', async () => {
        const screen = await render(
            <Visit open={false} onOpenChange={() => undefined} />
        )
        const trigger = screen.getByRole('button', { name: 'Details' })
        await trigger.click()
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('labels the trigger with your words and keeps it at least 24 pixels', async () => {
        const screen = await render(
            <VisitList>
                <VisitItem>
                    <VisitItemTrigger>Show measurements</VisitItemTrigger>
                    <VisitItemContent>Height 68 cm</VisitItemContent>
                </VisitItem>
            </VisitList>
        )
        const trigger = screen
            .getByRole('button', { name: 'Show measurements' })
            .element()
        const { width, height } = trigger.getBoundingClientRect()
        expect(width).toBeGreaterThanOrEqual(24)
        expect(height).toBeGreaterThanOrEqual(24)
    })
})
