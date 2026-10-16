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
import { useWorkingListText } from '../WorkingListText'

const visuallyHiddenClassName =
    'absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!'

const pillButtonClassName =
    'cursor-pointer border-0 bg-transparent [font:inherit] text-[inherit] focus-visible:[outline:3px_solid_rgb(20_124_215_/_35%)] focus-visible:outline-offset-[-2px]'

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
                className="flex min-w-0 flex-col gap-2 border-b border-[#e8edf2] px-2 pt-0 pb-2"
                data-testid="saved-list-bar"
            >
                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
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
                                className={
                                    selected
                                        ? 'inline-flex min-h-[30px] items-stretch overflow-hidden rounded-2xl border border-transparent bg-[#087f73] text-[13px] leading-[18px] font-medium text-white'
                                        : 'inline-flex min-h-[30px] items-stretch overflow-hidden rounded-2xl border border-transparent bg-[#f3f5f7] text-[13px] leading-[18px] font-medium text-[#405261]'
                                }
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
                                <button
                                    type="button"
                                    className={`${pillButtonClassName} px-[11px] py-[5px] ${selected ? '[&:hover]:bg-[#076b62] [&:hover]:text-white' : '[&:hover]:bg-[#eaf3fa] [&:hover]:text-[#1d5280]'}`}
                                    aria-current={selected ? 'true' : undefined}
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
                                                className="ml-1 font-bold"
                                                data-testid="working-list-dirty-indicator"
                                            >
                                                *
                                            </span>
                                            <span
                                                className={
                                                    visuallyHiddenClassName
                                                }
                                                data-testid="working-list-dirty-label"
                                            >
                                                {i18n.t('Unsaved changes')}
                                            </span>
                                        </>
                                    )}
                                </button>
                                {hasMenu && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            className={`${pillButtonClassName} relative inline-flex w-7 items-center justify-center px-1.5 py-0 before:absolute before:top-1/2 before:left-0 before:h-4 before:w-px before:-translate-y-1/2 before:content-[''] [&_svg]:block ${selected ? 'before:bg-[rgb(255_255_255_/_35%)] [&:hover]:bg-[#076b62] [&:hover]:text-white' : 'before:bg-[#c4cdd5] [&:hover]:bg-[#eaf3fa] [&:hover]:text-[#1d5280]'}`}
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
                </div>
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
