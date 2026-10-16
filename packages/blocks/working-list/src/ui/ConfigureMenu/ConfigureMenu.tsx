import { Button } from '../primitives/button'
import { Spinner } from '../primitives/spinner'
import {
    DropdownButton,
    FlyoutMenu,
    MenuItem,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
} from '@dhis2/ui'
import { IconMore16 } from '@dhis2/ui-icons'
import React, { useId, useState } from 'react'
import type { WorkingListSavedView } from '../../provider/contracts'
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
    const [saveMenuOpen, setSaveMenuOpen] = useState(false)
    const [moreMenuOpen, setMoreMenuOpen] = useState(false)
    const persistedSelection =
        selectedView && !selectedView.generated ? selectedView : undefined
    const canUpdate =
        persistedSelection?.compatible === true && persistedSelection.canUpdate
    const locked = !online || busy
    const openSaveAs = () => {
        setSaveMenuOpen(false)
        setName('')
        setNameError(undefined)
        setNameDialogOpen(true)
    }

    return (
        <>
            <div
                className="ml-auto flex flex-shrink-0 items-center gap-1"
                data-testid="working-list-actions"
                onKeyDownCapture={(event) => {
                    if (event.key === 'Escape') {
                        setSaveMenuOpen(false)
                        setMoreMenuOpen(false)
                    }
                }}
            >
                {persistedSelection ? (
                    <DropdownButton
                        secondary
                        small
                        dataTest="save-working-list"
                        open={saveMenuOpen}
                        disabled={locked}
                        onClick={({ open }) => setSaveMenuOpen(open)}
                        component={
                            <FlyoutMenu dense>
                                <MenuItem
                                    dataTest="update-working-list"
                                    disabled={!canUpdate || !dirty || locked}
                                    label={i18n.t('Save changes to this view')}
                                    onClick={() => {
                                        setSaveMenuOpen(false)
                                        if (dirty && canUpdate) {
                                            onUpdate()
                                        }
                                    }}
                                />
                                <MenuItem
                                    dataTest="save-as-working-list"
                                    disabled={locked}
                                    label={i18n.t('Create new view…')}
                                    onClick={openSaveAs}
                                />
                            </FlyoutMenu>
                        }
                    >
                        {i18n.t('Save view')}
                    </DropdownButton>
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
                        <DropdownButton
                            secondary
                            small
                            icon=<IconMore16 />
                            dataTest="working-list-options"
                            open={moreMenuOpen}
                            onClick={({ open }) => setMoreMenuOpen(open)}
                            component={
                                <FlyoutMenu dense>
                                    <MenuItem
                                        dataTest="download-working-list"
                                        label={i18n.t('Download data…')}
                                        onClick={() => {
                                            setMoreMenuOpen(false)
                                            onDownload()
                                        }}
                                    />
                                </FlyoutMenu>
                            }
                        >
                            {i18n.t('More')}
                        </DropdownButton>
                    </>
                )}
            </div>

            {nameDialogOpen && (
                <Modal
                    small
                    position="middle"
                    onClose={() => setNameDialogOpen(false)}
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
                        <ModalTitle>
                            {i18n.t('Save as new working list')}
                        </ModalTitle>
                        <ModalContent>
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
                        </ModalContent>
                        <ModalActions>
                            <div className="flex flex-wrap items-center justify-end gap-2">
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
                                    disabled={
                                        !name.trim() || busy || createPending
                                    }
                                >
                                    {createPending && (
                                        <Spinner
                                            data-icon="inline-start"
                                            className="size-4"
                                        />
                                    )}
                                    {i18n.t('Save')}
                                </Button>
                            </div>
                        </ModalActions>
                    </form>
                </Modal>
            )}
        </>
    )
}
