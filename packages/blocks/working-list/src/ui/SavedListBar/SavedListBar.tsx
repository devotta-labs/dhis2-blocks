import { Button } from '../primitives/button'
import { IconMore16 } from '@dhis2/ui-icons'
import React, { useRef, useState } from 'react'
import type { WorkingListSavedView } from '../../provider/contracts'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../primitives/alert-dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../primitives/dropdown-menu'
import { cn } from '../primitives/cn'
import { toggleVariants } from '../primitives/toggle'
import { ToggleGroup, ToggleGroupItem } from '../primitives/toggle-group'
import { useWorkingListText } from '../WorkingListText'

interface SavedListBarProps {
    lists: readonly WorkingListSavedView[]
    selectedId?: string
    dirty: boolean
    online: boolean
    busy: boolean
    onSelect: (list: WorkingListSavedView) => void
    onUpdate: (list: WorkingListSavedView) => void
    onShare: (list: WorkingListSavedView) => void
    onDelete: (list: WorkingListSavedView) => void
}

export const SavedListBar = ({
    lists,
    selectedId,
    dirty,
    online,
    busy,
    onSelect,
    onUpdate,
    onShare,
    onDelete,
}: SavedListBarProps) => {
    const i18n = { t: useWorkingListText() }
    // The actions menu lines up with the whole pill, not just its trigger.
    const pillElements = useRef(new Map<string, HTMLElement>())
    const [deleteList, setDeleteList] = useState<WorkingListSavedView>()
    const generatedListName = (list: WorkingListSavedView) => {
        if (!list.generated) {
            return list.name
        }
        const names = new Map([
            ['active', i18n.t('Active enrollments')],
            ['completed', i18n.t('Completed enrollments')],
            ['cancelled', i18n.t('Cancelled enrollments')],
        ])
        return names.get(list.id) ?? list.name
    }
    const savedListLocked = !online || busy

    return (
        <>
            <div
                className="flex min-w-0 flex-col gap-2 border-b border-border px-2 pt-0 pb-2"
                data-testid="saved-list-bar"
            >
                <ToggleGroup
                    className="min-w-0 max-w-full"
                    variant="outline"
                    size="sm"
                    value={selectedId ? [selectedId] : []}
                >
                    {lists.map((list) => {
                        const selected = selectedId === list.id
                        const incompatible = !list.compatible
                        const canUpdate =
                            selected && dirty && !incompatible && list.canUpdate
                        const canShare = list.canShare
                        const canDelete = list.canDelete
                        const hasMenu =
                            !list.generated &&
                            (canUpdate || canShare || canDelete)
                        const name = generatedListName(list)

                        return (
                            <span
                                key={list.id}
                                className="inline-flex"
                                data-testid={`working-list-view-${list.id}`}
                                ref={(element) => {
                                    if (element) {
                                        pillElements.current.set(
                                            list.id,
                                            element
                                        )
                                    } else {
                                        pillElements.current.delete(list.id)
                                    }
                                }}
                            >
                                <ToggleGroupItem
                                    value={list.id}
                                    className={cn(hasMenu && 'rounded-r-none')}
                                    title={
                                        incompatible
                                            ? i18n.t('This view is unavailable')
                                            : undefined
                                    }
                                    onClick={() => onSelect(list)}
                                >
                                    {name}
                                    {incompatible &&
                                        ` (${i18n.t('Unavailable')})`}
                                    {selected && dirty && (
                                        <>
                                            <span
                                                aria-hidden="true"
                                                className="-ml-1 font-bold"
                                                data-testid="working-list-dirty-indicator"
                                            >
                                                *
                                            </span>
                                            <span
                                                className="sr-only"
                                                data-testid="working-list-dirty-label"
                                            >
                                                {i18n.t('Unsaved changes')}
                                            </span>
                                        </>
                                    )}
                                </ToggleGroupItem>
                                {hasMenu && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            // Mirrors the toggle's pressed look so the pill reads as one.
                                            data-pressed={
                                                selected ? '' : undefined
                                            }
                                            className={toggleVariants({
                                                variant: 'outline',
                                                size: 'sm',
                                                className:
                                                    'w-7 rounded-l-none border-l-0 px-0',
                                            })}
                                            data-saved-view-menu
                                            data-testid={`working-list-view-${list.id}-menu`}
                                            aria-label={i18n.t(
                                                'Actions for {{name}}',
                                                { name }
                                            )}
                                        >
                                            <IconMore16 />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            data-test="saved-view-actions-menu"
                                            anchor={() =>
                                                pillElements.current.get(
                                                    list.id
                                                ) ?? null
                                            }
                                        >
                                            {canUpdate && (
                                                <DropdownMenuItem
                                                    data-test="update-saved-view"
                                                    disabled={savedListLocked}
                                                    onClick={() =>
                                                        onUpdate(list)
                                                    }
                                                >
                                                    {i18n.t(
                                                        'Save changes to this view'
                                                    )}
                                                </DropdownMenuItem>
                                            )}
                                            {canShare && (
                                                <DropdownMenuItem
                                                    data-test="share-saved-view"
                                                    disabled={savedListLocked}
                                                    onClick={() =>
                                                        onShare(list)
                                                    }
                                                >
                                                    {i18n.t('Manage sharing')}
                                                </DropdownMenuItem>
                                            )}
                                            {canDelete && (
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    data-test="delete-saved-view"
                                                    disabled={savedListLocked}
                                                    onClick={() =>
                                                        setDeleteList(list)
                                                    }
                                                >
                                                    {i18n.t('Delete view')}
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </span>
                        )
                    })}
                </ToggleGroup>
            </div>

            {deleteList && (
                <AlertDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            setDeleteList(undefined)
                        }
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {i18n.t('Delete view?')}
                            </AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogDescription>
                            {i18n.t('“{{name}}” will be permanently deleted.', {
                                name: deleteList.name,
                            })}
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                            <AlertDialogCancel data-test="delete-saved-view-cancel">
                                {i18n.t('Cancel')}
                            </AlertDialogCancel>
                            <Button
                                variant="destructive"
                                data-test="delete-saved-view-confirm"
                                disabled={savedListLocked}
                                onClick={() => {
                                    onDelete(deleteList)
                                    setDeleteList(undefined)
                                }}
                            >
                                {i18n.t('Delete')}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </>
    )
}
