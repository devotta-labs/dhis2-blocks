import * as React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { userEvent } from 'vitest/browser'
import { Button } from './button'
import { Checkbox } from './checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './dropdown-menu'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { Switch } from './switch'
import { Toggle } from './toggle'

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const cases = [
    ['button', <Button>Action</Button>],
    ['checkbox', <Checkbox aria-label="Enabled" />],
    ['switch', <Switch aria-label="Enabled" />],
    ['toggle', <Toggle aria-label="Enabled" />],
    [
        'radio-group-item',
        <RadioGroup aria-label="Choice" defaultValue="a">
            <RadioGroupItem value="a" aria-label="Alpha" />
        </RadioGroup>,
    ],
    [
        'dropdown-menu-item',
        <DropdownMenu defaultOpen>
            <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>Action</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>,
    ],
    [
        'dialog-close',
        <Dialog defaultOpen>
            <DialogContent>
                <DialogTitle>Title</DialogTitle>
                <DialogDescription>Description</DialogDescription>
            </DialogContent>
        </Dialog>,
    ],
] as const

test.each(cases)(
    '%s has a visible keyboard focus outline',
    async (slot, element) => {
        const original = globalThis.IS_REACT_ACT_ENVIRONMENT
        globalThis.IS_REACT_ACT_ENVIRONMENT = true
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)

        try {
            await act(async () => userEvent.keyboard('{Tab}'))
            await act(async () => root.render(element))
            const control = document.querySelector<HTMLElement>(
                `[data-slot="${slot}"]`
            )

            expect(control).not.toBeNull()
            act(() => control?.focus())
            expect(control?.matches(':focus-visible')).toBe(true)
            if (control === null) return

            const style = getComputedStyle(control)

            expect(style.outlineStyle).toBe('solid')
            expect(style.outlineWidth).toBe('3px')
            expect(style.outlineColor).toBe('rgb(20, 124, 215)')
        } finally {
            act(() => root.unmount())
            container.remove()
            globalThis.IS_REACT_ACT_ENVIRONMENT = original
        }
    }
)
