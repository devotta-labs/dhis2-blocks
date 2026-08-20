import {
    Button,
    FlyoutMenu,
    InputField,
    MenuItem,
    MenuSectionHeader,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
    NoticeBox,
    Popover,
    SharingDialog,
} from '@dhis2/ui'
import React, { useEffect, useState } from 'react'
import {
    getSharingType,
    type NormalizedSavedWorkingList,
    type SavedListResource,
} from '../../api/savedLists'
import filterStyles from '../FilterControls/FilterControls.module.css'
import layoutStyles from '../styles/layout.module.css'
import { useWorkingListText } from '../WorkingListText'
import styles from './ConfigureMenu.module.css'

interface ConfigureMenuProps {
    selectedList?: NormalizedSavedWorkingList
    selectedIsGenerated: boolean
    activeResource: SavedListResource
    dirty: boolean
    online: boolean
    busy: boolean
    onDelete: (list: NormalizedSavedWorkingList) => void
    onRename: (list: NormalizedSavedWorkingList, name: string) => void
    onSaveAs: (name: string) => void
    onSharingSaved: () => void
    onUpdate: (list: NormalizedSavedWorkingList) => void
    /** When omitted, the Columns group is left out of the menu. */
    onConfigureColumns?: () => void
}

const accessFor = (list: NormalizedSavedWorkingList | undefined) =>
    list?.sharing.access as Record<string, unknown> | undefined

const canUpdateList = (list: NormalizedSavedWorkingList | undefined) => {
    const access = accessFor(list)
    return access?.write === true && access.update === true
}

const canDeleteList = (list: NormalizedSavedWorkingList | undefined) =>
    accessFor(list)?.delete === true

const canManageList = (list: NormalizedSavedWorkingList | undefined) =>
    accessFor(list)?.manage === true

export const ConfigureMenu = ({
    selectedList,
    selectedIsGenerated,
    activeResource,
    dirty,
    online,
    busy,
    onDelete,
    onRename,
    onSaveAs,
    onSharingSaved,
    onUpdate,
    onConfigureColumns,
}: ConfigureMenuProps) => {
    const i18n = { t: useWorkingListText() }
    const [nameDialog, setNameDialog] = useState<'saveAs' | 'rename'>()
    const [name, setName] = useState('')
    const [sharingList, setSharingList] = useState<NormalizedSavedWorkingList>()
    const [deleteList, setDeleteList] = useState<NormalizedSavedWorkingList>()
    const [sharingError, setSharingError] = useState<string>()
    const [optionsOpen, setOptionsOpen] = useState(false)
    const [optionsReference, setOptionsReference] =
        useState<HTMLDivElement | null>(null)
    const [optionsMenu, setOptionsMenu] = useState<HTMLDivElement | null>(null)
    const canUpdate =
        !selectedIsGenerated &&
        selectedList?.compatibility === 'compatible' &&
        canUpdateList(selectedList) &&
        selectedList.resource === activeResource &&
        dirty
    const canRename =
        !selectedIsGenerated &&
        selectedList?.compatibility === 'compatible' &&
        canUpdateList(selectedList)
    const canDelete = !selectedIsGenerated && canDeleteList(selectedList)
    const canShare = !selectedIsGenerated && canManageList(selectedList)
    const savedListLocked = !online || busy
    const optionsTrigger = () =>
        optionsReference?.querySelector<HTMLButtonElement>(
            '[data-test="working-list-options"]'
        )
    const closeOptions = () => {
        setOptionsOpen(false)
        optionsTrigger()?.focus()
    }

    useEffect(() => {
        if (!optionsOpen || !optionsMenu) {
            return
        }
        const frame = requestAnimationFrame(() => {
            optionsMenu
                .querySelector<HTMLElement>('[role="presentation"][tabindex]')
                ?.focus()
        })
        return () => cancelAnimationFrame(frame)
    }, [optionsMenu, optionsOpen])

    return (
        <>
            <div ref={setOptionsReference} className={styles['configure-menu']}>
                <button
                    type="button"
                    className={filterStyles['filter-button']}
                    data-test="working-list-options"
                    data-testid="working-list-options"
                    aria-controls={
                        optionsOpen ? 'working-list-options-menu' : undefined
                    }
                    aria-expanded={optionsOpen}
                    aria-haspopup="menu"
                    onClick={() => setOptionsOpen((open) => !open)}
                >
                    {i18n.t('Configure')}
                    <span aria-hidden="true">▾</span>
                </button>
                {optionsOpen && optionsReference && (
                    <Popover
                        placement="bottom-end"
                        reference={optionsReference}
                        onClickOutside={closeOptions}
                    >
                        <div
                            ref={setOptionsMenu}
                            id="working-list-options-menu"
                            className={filterStyles['menu-popover-sheet']}
                        >
                            <FlyoutMenu
                                dense
                                dataTest="working-list-options-menu"
                                closeMenu={closeOptions}
                            >
                                <MenuSectionHeader
                                    hideDivider
                                    label={i18n.t('Saved list')}
                                />
                                {canUpdate && selectedList && (
                                    <MenuItem
                                        dataTest="update-working-list"
                                        disabled={savedListLocked}
                                        label={i18n.t('Update saved list')}
                                        onClick={() => {
                                            closeOptions()
                                            onUpdate(selectedList)
                                        }}
                                    />
                                )}
                                <MenuItem
                                    dataTest="save-as-working-list"
                                    disabled={savedListLocked}
                                    label={i18n.t('Save as new')}
                                    onClick={() => {
                                        closeOptions()
                                        setName('')
                                        setNameDialog('saveAs')
                                    }}
                                />
                                {canRename && selectedList && (
                                    <MenuItem
                                        dataTest="rename-working-list"
                                        disabled={savedListLocked}
                                        label={i18n.t('Rename')}
                                        onClick={() => {
                                            closeOptions()
                                            setName(selectedList.name)
                                            setNameDialog('rename')
                                        }}
                                    />
                                )}
                                {canShare && selectedList && (
                                    <MenuItem
                                        dataTest="share-working-list"
                                        disabled={savedListLocked}
                                        label={i18n.t('Sharing and access')}
                                        onClick={() => {
                                            closeOptions()
                                            setSharingError(undefined)
                                            setSharingList(selectedList)
                                        }}
                                    />
                                )}
                                {canDelete && selectedList && (
                                    <MenuItem
                                        destructive
                                        dataTest="delete-working-list"
                                        disabled={savedListLocked}
                                        label={i18n.t('Delete')}
                                        onClick={() => {
                                            closeOptions()
                                            setDeleteList(selectedList)
                                        }}
                                    />
                                )}
                                {onConfigureColumns && (
                                    <MenuSectionHeader
                                        label={i18n.t('Columns')}
                                    />
                                )}
                                {onConfigureColumns && (
                                    <MenuItem
                                        dataTest="configure-columns"
                                        label={i18n.t('Configure columns')}
                                        onClick={() => {
                                            closeOptions()
                                            onConfigureColumns()
                                        }}
                                    />
                                )}
                            </FlyoutMenu>
                        </div>
                    </Popover>
                )}
            </div>

            {nameDialog && (
                <Modal
                    small
                    position="middle"
                    onClose={() => setNameDialog(undefined)}
                >
                    <form
                        className={styles['working-list-name-form']}
                        onSubmit={(event) => {
                            event.preventDefault()
                            const nextName = name.trim()
                            if (!nextName || busy) {
                                return
                            }
                            if (nameDialog === 'rename') {
                                if (!selectedList) {
                                    return
                                }
                                onRename(selectedList, nextName)
                            } else {
                                onSaveAs(nextName)
                            }
                            setNameDialog(undefined)
                        }}
                    >
                        <ModalTitle>
                            {nameDialog === 'rename'
                                ? i18n.t('Rename working list')
                                : i18n.t('Save as new working list')}
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
                                    onClick={() => setNameDialog(undefined)}
                                >
                                    {i18n.t('Cancel')}
                                </Button>
                                <Button
                                    primary
                                    type="submit"
                                    dataTest="working-list-name-submit"
                                    disabled={!name.trim() || busy}
                                >
                                    {nameDialog === 'rename'
                                        ? i18n.t('Rename')
                                        : i18n.t('Save')}
                                </Button>
                            </div>
                        </ModalActions>
                    </form>
                </Modal>
            )}

            {deleteList && (
                <Modal
                    small
                    position="middle"
                    onClose={() => setDeleteList(undefined)}
                >
                    <ModalTitle>{i18n.t('Delete working list?')}</ModalTitle>
                    <ModalContent>
                        {i18n.t('“{{name}}” will be permanently deleted.', {
                            name: deleteList.name,
                        })}
                    </ModalContent>
                    <ModalActions>
                        <div className={layoutStyles['modal-button-strip']}>
                            <Button
                                dataTest="delete-working-list-cancel"
                                onClick={() => setDeleteList(undefined)}
                            >
                                {i18n.t('Cancel')}
                            </Button>
                            <Button
                                destructive
                                dataTest="delete-working-list-confirm"
                                disabled={busy}
                                onClick={() => {
                                    onDelete(deleteList)
                                    setDeleteList(undefined)
                                }}
                            >
                                {i18n.t('Delete')}
                            </Button>
                        </div>
                    </ModalActions>
                </Modal>
            )}

            {sharingError && (
                <NoticeBox error title={i18n.t('Could not update sharing')}>
                    {sharingError}
                </NoticeBox>
            )}

            {sharingList && (
                <SharingDialog
                    id={sharingList.id}
                    type={getSharingType(sharingList.resource)}
                    metadataSharing
                    onClose={() => setSharingList(undefined)}
                    onError={(error) =>
                        setSharingError(
                            error instanceof Error
                                ? error.message
                                : String(error)
                        )
                    }
                    onSave={() => {
                        setSharingError(undefined)
                        setSharingList(undefined)
                        onSharingSaved()
                    }}
                />
            )}
        </>
    )
}
