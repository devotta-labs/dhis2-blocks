import React from 'react'
import type { NormalizedSavedWorkingList } from '../../api/savedLists'
import accessibilityStyles from '../styles/accessibility.module.css'
import { useWorkingListText } from '../WorkingListText'
import styles from './SavedListBar.module.css'

interface SavedListBarProps {
    lists: NormalizedSavedWorkingList[]
    selectedId?: string
    listsAreGenerated: boolean
    /** Marks the active list with an unsaved-changes indicator. */
    dirty: boolean
    onSelect: (list: NormalizedSavedWorkingList) => void
}

export const SavedListBar = ({
    lists,
    selectedId,
    listsAreGenerated,
    dirty,
    onSelect,
}: SavedListBarProps) => {
    const i18n = { t: useWorkingListText() }
    const generatedListName = (list: NormalizedSavedWorkingList) => {
        if (!listsAreGenerated) {
            return list.name
        }
        const names = new Map([
            ['active', i18n.t('Active enrollments')],
            ['completed', i18n.t('Completed enrollments')],
            ['cancelled', i18n.t('Cancelled enrollments')],
        ])
        return names.get(list.id) ?? list.name
    }

    return (
        <section
            className={styles['saved-list-bar']}
            data-testid="saved-list-bar"
            aria-label={i18n.t('Working list views')}
        >
            <div className={styles['saved-list-pills']}>
                {lists.map((list) => {
                    const incompatible = list.compatibility === 'incompatible'
                    return (
                        <button
                            key={`${list.resource}-${list.id}`}
                            type="button"
                            className={`${styles['saved-list-pill']}${
                                selectedId === list.id
                                    ? ` ${styles['saved-list-pill--active']}`
                                    : ''
                            }`}
                            data-testid={`working-list-view-${list.id}`}
                            aria-current={
                                selectedId === list.id ? 'true' : undefined
                            }
                            title={
                                incompatible
                                    ? i18n.t('This view is unavailable')
                                    : undefined
                            }
                            onClick={() => onSelect(list)}
                        >
                            {generatedListName(list)}
                            {incompatible && ` (${i18n.t('Unavailable')})`}
                            {selectedId === list.id && dirty && (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className={
                                            styles['saved-list-pill__dirty']
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
                    )
                })}
            </div>
        </section>
    )
}
