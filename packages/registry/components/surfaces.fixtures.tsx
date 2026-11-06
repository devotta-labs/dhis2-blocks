import React from 'react'
import { Alert } from './alert'
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogTitle,
} from './alert-dialog'
import { Card } from './card'
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from './combobox'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './select'
import { Separator } from './separator'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from './tooltip'

/** Open surfaces for colour tests: each part is found by its data-slot. */
export const OpenMenu = () => (
    <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
)

export const OpenSelect = () => (
    <Select defaultOpen defaultValue="a">
        <SelectTrigger aria-label="Letter">
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="a">Alpha</SelectItem>
            <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
    </Select>
)

export const OpenCombobox = () => (
    <Combobox items={['Alpha', 'Beta']} defaultOpen>
        <ComboboxInput aria-label="Letter" />
        <ComboboxContent>
            <ComboboxList>
                {(item: string) => (
                    <ComboboxItem key={item} value={item}>
                        {item}
                    </ComboboxItem>
                )}
            </ComboboxList>
        </ComboboxContent>
    </Combobox>
)

export const OpenDialog = () => (
    <Dialog defaultOpen>
        <DialogContent>
            <DialogTitle>Edit</DialogTitle>
        </DialogContent>
    </Dialog>
)

export const OpenAlertDialog = () => (
    <AlertDialog defaultOpen>
        <AlertDialogContent>
            <AlertDialogTitle>Delete?</AlertDialogTitle>
        </AlertDialogContent>
    </AlertDialog>
)

export const PlainCard = () => <Card>Body</Card>

export const OpenPopover = () => (
    <Popover defaultOpen>
        <PopoverTrigger>Details</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
    </Popover>
)

export const OpenTooltip = () => (
    <TooltipProvider>
        <Tooltip defaultOpen>
            <TooltipTrigger>Help</TooltipTrigger>
            <TooltipContent>Tip</TooltipContent>
        </Tooltip>
    </TooltipProvider>
)

export const WarningAlert = () => (
    <Alert variant="warning">
        <svg data-testid="alert-icon" viewBox="0 0 1 1" />
        Careful
    </Alert>
)

export const Divider = () => <Separator />

export const find = async (selector: string): Promise<Element> => {
    await expect.poll(() => document.querySelector(selector)).not.toBeNull()
    const element = document.querySelector(selector)
    if (element === null) throw new Error(`no ${selector}`)
    return element
}

export const slot = (name: string): Promise<Element> =>
    find(`[data-slot="${name}"]`)

export const style = (element: Element) => getComputedStyle(element)
