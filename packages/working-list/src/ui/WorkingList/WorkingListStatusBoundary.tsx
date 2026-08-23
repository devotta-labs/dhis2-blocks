import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import React, { type ReactNode } from 'react'
import type { NormalizedSavedWorkingList } from '../../api/savedLists'
import { useWorkingListText } from '../WorkingListText'
import styles from './WorkingList.module.css'
import { WorkingListStatuses } from './selection'

type WorkingListStatus =
    (typeof WorkingListStatuses)[keyof typeof WorkingListStatuses]

interface WorkingListStatusBoundaryProps {
    status: WorkingListStatus
    selectedList?: NormalizedSavedWorkingList
    repairAvailable: boolean
    canRepair: boolean
    onRetryCreatedList: () => void
    onUseDefaultList: () => void
    onReviewRepair: () => void
    children: ReactNode
}

export const WorkingListStatusBoundary = ({
    status,
    selectedList,
    repairAvailable,
    canRepair,
    onRetryCreatedList,
    onUseDefaultList,
    onReviewRepair,
    children,
}: WorkingListStatusBoundaryProps) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }

    if (status === WorkingListStatuses.CREATED_LIST_RELOAD_ERROR) {
        return (
            <section
                className={styles['working-list-blocking-error']}
                data-testid="created-list-reload-error"
            >
                <NoticeBox
                    error
                    title={i18n.t(
                        'The saved working list could not be reloaded'
                    )}
                >
                    <p>
                        {i18n.t(
                            'The list was created, but the server has not returned it yet. No records will be queried until it is available.'
                        )}
                    </p>
                    <Button
                        dataTest="retry-created-working-list"
                        onClick={onRetryCreatedList}
                    >
                        {i18n.t('Try again')}
                    </Button>
                </NoticeBox>
            </section>
        )
    }

    if (status === WorkingListStatuses.INVALID_TEMPLATE_ID) {
        return (
            <section
                className={styles['working-list-blocking-error']}
                data-testid="unavailable-working-list-error"
            >
                <NoticeBox
                    error
                    title={i18n.t('This working list is unavailable')}
                >
                    <p>
                        {i18n.t(
                            'The selected working list may no longer exist, or you may no longer have access. No records will be queried while it is selected.'
                        )}
                    </p>
                    <Button
                        dataTest="use-default-working-list"
                        onClick={onUseDefaultList}
                    >
                        {i18n.t('Use the default working list')}
                    </Button>
                </NoticeBox>
            </section>
        )
    }

    if (
        status === WorkingListStatuses.INCOMPATIBLE_TEMPLATE &&
        selectedList?.compatibility === 'incompatible'
    ) {
        const title = repairAvailable
            ? i18n.t('This saved list has unavailable settings')
            : i18n.t('This saved list is unavailable')
        const description = repairAvailable
            ? canRepair
                ? i18n.t(
                      'Some filters, columns, or sorting options are no longer available. Repair lets you review the proposed changes before updating the list.'
                  )
                : i18n.t(
                      'Some parts of this list are no longer available. Ask someone who can edit the list to repair it, or select another list.'
                  )
            : i18n.t(
                  'A required part of this list is no longer available. The program metadata may have changed, or you may no longer have access. Select another list, or use the list menu for more options.'
              )

        return (
            <section
                className={styles['stale-list-panel']}
                data-testid="stale-list-panel"
                aria-label={title}
            >
                <NoticeBox error title={title}>
                    <p>{description}</p>
                    {repairAvailable && canRepair && (
                        <div className={styles['stale-list-repair-action']}>
                            <Button
                                small
                                dataTest="repair-working-list"
                                onClick={onReviewRepair}
                            >
                                {i18n.t('Repair')}
                            </Button>
                        </div>
                    )}
                </NoticeBox>
            </section>
        )
    }

    if (status === WorkingListStatuses.LOADING) {
        return (
            <section
                className={styles['working-list-selection-loading']}
                data-testid="working-list-selection-loading"
                aria-live="polite"
            >
                <CircularLoader small />
                <p>{i18n.t('Loading the selected working list…')}</p>
            </section>
        )
    }

    return <>{children}</>
}
