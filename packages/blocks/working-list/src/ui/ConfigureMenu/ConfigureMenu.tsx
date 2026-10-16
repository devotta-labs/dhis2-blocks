import { Button } from '../primitives/button'
import { Spinner } from '../primitives/spinner'
import { IconMore16 } from '@dhis2/ui-icons'
import React, { useId, useState } from 'react'
import type { WorkingListSavedView } from '../../provider/contracts'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../primitives/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuTriggerArrow,
} from '../primitives/dropdown-menu'
import { Field, FieldLabel } from '../primitives/field'
import { Input } from '../primitives/input'
import { useWorkingListText } from '../WorkingListText'

interface ConfigureMenuProps {
    selectedView?: WorkingListSavedView
    dirty: boolean
    online: boolean
    busy: boolean
    createPending: boolean
    onDownload: () => void
    onSaveAs: (name: string) => Promise<string | undefined>
    onUpdate: () => void
}

export const ConfigureMenu = ({
    selectedView,
    dirty,
    online,
    busy,
    createPending,
    onDownload,
    onSaveAs,
    onUpdate,
}: ConfigureMenuProps) => {
    const i18n = { t: useWorkingListText() }
    const [nameDialogOpen, setNameDialogOpen] = useState(false)
    const [name, setName] = useState('')
    const nameInputId = useId()
    const [nameError, setNameError] = useState<string>()
    const persistedSelection =
        selectedView && !selectedView.generated ? selectedView : undefined
    const canUpdate =
        persistedSelection?.compatible === true && persistedSelection.canUpdate
    const locked = !online || busy
    const openSaveAs = () => {
        setName('')
        setNameError(undefined)
        setNameDialogOpen(true)
    }

    return (
        <>
            <div
                className="ml-auto flex flex-shrink-0 items-center gap-1"
                data-testid="working-list-actions"
            >
                {persistedSelection ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            disabled={locked}
                            render={
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    data-test="save-working-list"
                                />
                            }
                        >
                            {i18n.t('Save view')}
                            <DropdownMenuTriggerArrow />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem
                                data-test="update-working-list"
                                disabled={!canUpdate || !dirty || locked}
                                onClick={() => {
                                    if (dirty && canUpdate) {
                                        onUpdate()
                                    }
                                }}
                            >
                                {i18n.t('Save changes to this view')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                data-test="save-as-working-list"
                                disabled={locked}
                                onClick={openSaveAs}
                            >
                                {i18n.t('Create new view…')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            data-test="save-working-list"
                            disabled={locked}
                            onClick={openSaveAs}
                        >
                            {i18n.t('Save view')}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        data-test="working-list-options"
                                    />
                                }
                            >
                                <IconMore16 />
                                {i18n.t('More')}
                                <DropdownMenuTriggerArrow />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem
                                    data-test="download-working-list"
                                    onClick={onDownload}
                                >
                                    {i18n.t('Download data…')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                )}
            </div>

            <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
                <DialogContent
                    size="sm"
                    position="middle"
                    closeLabel={i18n.t('Close')}
                >
                    <form
                        className="flex min-w-0 flex-col"
                        onSubmit={(event) => {
                            event.preventDefault()
                            const nextName = name.trim()
                            if (!nextName || busy) {
                                return
                            }
                            setNameError(undefined)
                            void onSaveAs(nextName).then((error) => {
                                if (error) {
                                    setNameError(error)
                                    return
                                }
                                setNameDialogOpen(false)
                            })
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>
                                {i18n.t('Save as new working list')}
                            </DialogTitle>
                        </DialogHeader>
                        <div>
                            <Field data-test="working-list-name-input">
                                <FieldLabel htmlFor={nameInputId}>
                                    {i18n.t('Name')}
                                    <span aria-hidden="true">*</span>
                                </FieldLabel>
                                <Input
                                    id={nameInputId}
                                    required
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                />
                            </Field>
                            {nameError && (
                                <p
                                    role="alert"
                                    data-testid="working-list-name-error"
                                >
                                    {nameError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                type="button"
                                data-test="working-list-name-cancel"
                                onClick={() => setNameDialogOpen(false)}
                            >
                                {i18n.t('Cancel')}
                            </Button>
                            <Button
                                variant="secondary"
                                type="submit"
                                data-test="working-list-name-submit"
                                disabled={!name.trim() || busy || createPending}
                            >
                                {createPending && (
                                    <Spinner
                                        data-icon="inline-start"
                                        className="size-4"
                                    />
                                )}
                                {i18n.t('Save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}
