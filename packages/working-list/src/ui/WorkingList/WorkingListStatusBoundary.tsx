import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import React, { type ReactNode } from 'react'
import type { NormalizedSavedWorkingList } from '../../api/savedLists'
import type { StaleReferenceIssue } from '../../domain/staleReferences'
import {
    useWorkingListText,
    type WorkingListTranslate,
} from '../WorkingListText'
import styles from './WorkingList.module.css'
import { WorkingListStatuses } from './selection'

type WorkingListStatus =
    (typeof WorkingListStatuses)[keyof typeof WorkingListStatuses]

const staleIssueLabel = (
    issue: StaleReferenceIssue,
    translate: WorkingListTranslate
) => {
    const values = { reference: issue.referenceId }
    switch (issue.kind) {
        case 'programMismatch':
            return translate(
                'This view belongs to a different program ({{reference}}).',
                values
            )
        case 'missingProgramStage':
            return translate(
                'Program stage {{reference}} is no longer available.',
                values
            )
        case 'missingFilterField':
            return translate(
                'Filter field {{reference}} is no longer available.',
                values
            )
        case 'missingColumn':
            return translate(
                'Column {{reference}} is no longer available.',
                values
            )
        case 'missingSortField':
            return translate(
                'Sort field {{reference}} is no longer available.',
                values
            )
        case 'scopeMismatch':
            return translate(
                'Field {{reference}} cannot be used at this result level.',
                values
            )
        case 'fieldChanged':
            return translate(
                'Field {{reference}} has changed type or source.',
                values
            )
        case 'programStageFieldMismatch':
            return translate(
                'Field {{reference}} does not belong to this program stage.',
                values
            )
        case 'unsupportedFilter':
            return translate(
                'Filter {{reference}} is not supported by this server.',
                values
            )
        case 'noVisibleColumns':
            return translate('The repaired view would have no visible columns.')
    }
}

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
        return (
            <section
                className={styles['stale-list-panel']}
                data-testid="stale-list-panel"
                aria-labelledby="stale-list-heading"
            >
                <NoticeBox
                    error
                    title={i18n.t('This saved list cannot be used')}
                >
                    <p id="stale-list-heading">
                        {i18n.t(
                            'The list references metadata that is no longer available. No records will be queried while this list is selected.'
                        )}
                    </p>
                    <ul>
                        {selectedList.issues.map((issue) => (
                            <li
                                key={`${issue.kind}-${issue.path}-${issue.referenceId}`}
                            >
                                {staleIssueLabel(issue, translate)}
                            </li>
                        ))}
                    </ul>
                    <p>
                        {i18n.t(
                            repairAvailable
                                ? 'Review a repair that removes only unavailable references, or select another list. You can also delete the list or review its sharing settings using the controls above.'
                                : 'This view cannot be repaired automatically. Select another list, delete this list, or review its sharing settings using the controls above.'
                        )}
                    </p>
                    {repairAvailable && (
                        <>
                            {!canRepair && (
                                <p>
                                    {i18n.t(
                                        'You need update access to repair this saved list.'
                                    )}
                                </p>
                            )}
                            <Button
                                dataTest="repair-working-list"
                                disabled={!canRepair}
                                onClick={onReviewRepair}
                            >
                                {i18n.t('Review repair')}
                            </Button>
                        </>
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
