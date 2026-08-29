import {
    Button,
    FlyoutMenu,
    MenuItem,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
    Popover,
} from '@dhis2/ui'
import { IconMore16 } from '@dhis2/ui-icons'
import React, { useId, useState } from 'react'
import type { WorkingListSavedView } from '../../provider/contracts'
import accessibilityStyles from '../styles/accessibility.module.css'
import layoutStyles from '../styles/layout.module.css'
import { useWorkingListText } from '../WorkingListText'
import styles from './SavedListBar.module.css'

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

interface OpenMenu {
    list: WorkingListSavedView
    reference: HTMLElement
}

const focusFirstMenuItem = (element: HTMLElement | null) => {
    if (!element) {
        return
    }
    requestAnimationFrame(() => {
        requestAnimationFrame(() =>
            element
                .querySelector<HTMLElement>('[role="presentation"][tabindex]')
                ?.focus()
        )
    })
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
    const actionsMenuId = useId()
    const [openMenu, setOpenMenu] = useState<OpenMenu>()
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
    const closeMenu = (restoreFocus = true) => {
        if (restoreFocus) {
            openMenu?.reference
                .querySelector<HTMLButtonElement>('[data-saved-view-menu]')
                ?.focus()
        }
        setOpenMenu(undefined)
    }

    return (
        <>
            <div
                className={styles['saved-list-bar']}
                data-testid="saved-list-bar"
            >
                <div className={styles['saved-list-pills']}>
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
                                className={`${styles['saved-list-pill']}${
                                    selected
                                        ? ` ${styles['saved-list-pill--active']}`
                                        : ''
                                }`}
                                data-testid={`working-list-view-${list.id}`}
                            >
                                <button
                                    type="button"
                                    className={
                                        styles['saved-list-pill__select']
                                    }
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
                                                className={
                                                    styles[
                                                        'saved-list-pill__dirty'
                                                    ]
                                                }
                                                data-testid="working-list-dirty-indicator"
                                            >
                                                *
                                            </span>
                                            <span
                                                className={
                                                    accessibilityStyles[
                                                        'visually-hidden'
                                                    ]
                                                }
                                                data-testid="working-list-dirty-label"
                                            >
                                                {i18n.t('Unsaved changes')}
                                            </span>
                                        </>
                                    )}
                                </button>
                                {hasMenu && (
                                    <button
                                        type="button"
                                        className={
                                            styles['saved-list-pill__menu']
                                        }
                                        data-saved-view-menu
                                        data-testid={`working-list-view-${list.id}-menu`}
                                        aria-label={i18n.t(
                                            'Actions for {{name}}',
                                            { name }
                                        )}
                                        aria-controls={
                                            openMenu?.list.id === list.id
                                                ? actionsMenuId
                                                : undefined
                                        }
                                        aria-expanded={
                                            openMenu?.list.id === list.id
                                        }
                                        aria-haspopup="menu"
                                        onClick={(event) => {
                                            const reference =
                                                event.currentTarget
                                                    .parentElement
                                            if (!reference) {
                                                return
                                            }
                                            setOpenMenu((current) =>
                                                current?.list.id === list.id
                                                    ? undefined
                                                    : { list, reference }
                                            )
                                        }}
                                    >
                                        <IconMore16 />
                                    </button>
                                )}
                            </span>
                        )
                    })}
                </div>
            </div>

            {openMenu && (
                <Popover
                    placement="bottom-start"
                    reference={openMenu.reference}
                    onClickOutside={() => closeMenu()}
                >
                    <div
                        ref={focusFirstMenuItem}
                        id={actionsMenuId}
                        className={styles['saved-list-menu']}
                    >
                        <FlyoutMenu
                            dense
                            dataTest="saved-view-actions-menu"
                            closeMenu={() => closeMenu()}
                        >
                            {selectedId === openMenu.list.id &&
                                dirty &&
                                openMenu.list.compatible &&
                                openMenu.list.canUpdate && (
                                    <MenuItem
                                        dataTest="update-saved-view"
                                        disabled={savedListLocked}
                                        label={i18n.t(
                                            'Save changes to this view'
                                        )}
                                        onClick={() => {
                                            const list = openMenu.list
                                            closeMenu()
                                            onUpdate(list)
                                        }}
                                    />
                                )}
                            {openMenu.list.canShare && (
                                <MenuItem
                                    dataTest="share-saved-view"
                                    disabled={savedListLocked}
                                    label={i18n.t('Manage sharing')}
                                    onClick={() => {
                                        const list = openMenu.list
                                        closeMenu()
                                        onShare(list)
                                    }}
                                />
                            )}
                            {openMenu.list.canDelete && (
                                <MenuItem
                                    destructive
                                    dataTest="delete-saved-view"
                                    disabled={savedListLocked}
                                    label={i18n.t('Delete view')}
                                    onClick={() => {
                                        const list = openMenu.list
                                        closeMenu(false)
                                        setDeleteList(list)
                                    }}
                                />
                            )}
                        </FlyoutMenu>
                    </div>
                </Popover>
            )}

            {deleteList && (
                <Modal
                    small
                    position="middle"
                    onClose={() => setDeleteList(undefined)}
                >
                    <ModalTitle>{i18n.t('Delete view?')}</ModalTitle>
                    <ModalContent>
                        {i18n.t('“{{name}}” will be permanently deleted.', {
                            name: deleteList.name,
                        })}
                    </ModalContent>
                    <ModalActions>
                        <div className={layoutStyles['modal-button-strip']}>
                            <Button
                                dataTest="delete-saved-view-cancel"
                                onClick={() => setDeleteList(undefined)}
                            >
                                {i18n.t('Cancel')}
                            </Button>
                            <Button
                                destructive
                                dataTest="delete-saved-view-confirm"
                                disabled={savedListLocked}
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
        </>
    )
}
