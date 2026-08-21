import {
    Button,
    DropdownButton,
    FlyoutMenu,
    InputField,
    MenuItem,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
} from '@dhis2/ui'
import { IconMore16 } from '@dhis2/ui-icons'
import React, { useState } from 'react'
import type {
    NormalizedSavedWorkingList,
    SavedListResource,
} from '../../api/savedLists'
import layoutStyles from '../styles/layout.module.css'
import { useWorkingListText } from '../WorkingListText'
import styles from './ConfigureMenu.module.css'

interface ConfigureMenuProps {
    selectedList?: NormalizedSavedWorkingList
    selectedIsGenerated: boolean
    activeResource: SavedListResource
    hasFilters: boolean
    dirty: boolean
    online: boolean
    busy: boolean
    onDownload: () => void
    onSaveAs: (name: string) => void
    onUpdate: (list: NormalizedSavedWorkingList) => void
}

const canUpdateList = (list: NormalizedSavedWorkingList | undefined) => {
    const access = list?.sharing.access
    return access?.write === true && access.update === true
}

export const ConfigureMenu = ({
    selectedList,
    selectedIsGenerated,
    activeResource,
    hasFilters,
    dirty,
    online,
    busy,
    onDownload,
    onSaveAs,
    onUpdate,
}: ConfigureMenuProps) => {
    const i18n = { t: useWorkingListText() }
    const [nameDialogOpen, setNameDialogOpen] = useState(false)
    const [name, setName] = useState('')
    const [saveMenuOpen, setSaveMenuOpen] = useState(false)
    const [moreMenuOpen, setMoreMenuOpen] = useState(false)
    const persistedSelection =
        !selectedIsGenerated && selectedList ? selectedList : undefined
    const canUpdate =
        persistedSelection?.compatibility === 'compatible' &&
        persistedSelection.resource === activeResource &&
        canUpdateList(persistedSelection)
    const locked = !online || busy
    const openSaveAs = () => {
        setSaveMenuOpen(false)
        setName('')
        setNameDialogOpen(true)
    }

    return (
        <>
            <div
                className={styles['configure-menu']}
                data-testid="working-list-actions"
            >
                {persistedSelection ? (
                    <DropdownButton
                        small
                        dataTest="save-working-list"
                        open={saveMenuOpen}
                        disabled={locked}
                        onClick={({ open }) => setSaveMenuOpen(open)}
                        component={
                            <FlyoutMenu dense>
                                <MenuItem
                                    dataTest="update-working-list"
                                    disabled={!canUpdate || locked}
                                    label={i18n.t('Save changes to this view')}
                                    onClick={() => {
                                        setSaveMenuOpen(false)
                                        if (dirty && canUpdate) {
                                            onUpdate(persistedSelection)
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
                        {hasFilters && (
                            <Button
                                small
                                dataTest="save-working-list"
                                disabled={locked}
                                onClick={openSaveAs}
                            >
                                {i18n.t('Save view')}
                            </Button>
                        )}
                        <DropdownButton
                            secondary
                            small
                            icon={<IconMore16 />}
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
                        className={styles['working-list-name-form']}
                        onSubmit={(event) => {
                            event.preventDefault()
                            const nextName = name.trim()
                            if (!nextName || busy) {
                                return
                            }
                            onSaveAs(nextName)
                            setNameDialogOpen(false)
                        }}
                    >
                        <ModalTitle>
                            {i18n.t('Save as new working list')}
                        </ModalTitle>
                        <ModalContent>
                            <InputField
                                required
                                dataTest="working-list-name-input"
                                label={i18n.t('Name')}
                                value={name}
                                onChange={({ value }) => setName(value ?? '')}
                            />
                        </ModalContent>
                        <ModalActions>
                            <div className={layoutStyles['modal-button-strip']}>
                                <Button
                                    type="button"
                                    dataTest="working-list-name-cancel"
                                    onClick={() => setNameDialogOpen(false)}
                                >
                                    {i18n.t('Cancel')}
                                </Button>
                                <Button
                                    primary
                                    type="submit"
                                    dataTest="working-list-name-submit"
                                    disabled={!name.trim() || busy}
                                >
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
