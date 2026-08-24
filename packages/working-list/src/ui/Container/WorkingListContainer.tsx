import { CircularLoader, NoticeBox } from '@dhis2/ui'
import React, { type ReactNode } from 'react'
import { useWorkingListMeta } from '../../provider/WorkingListContext'
import { useWorkingListText } from '../WorkingListText'
import styles from '../WorkingList/WorkingList.module.css'

export interface WorkingListContainerProps {
    children: ReactNode
}

export const WorkingListContainer = ({
    children,
}: WorkingListContainerProps) => {
    const translate = useWorkingListText()
    const lifecycle = useWorkingListMeta((meta) => meta.lifecycle)
    const online = useWorkingListMeta((meta) => meta.online)
    const blocked = lifecycle.status !== 'ready'

    return (
        <div
            className={styles['working-list-main']}
            data-testid="working-list-main"
        >
            {!online && (
                <div
                    className={styles['offline-notice']}
                    data-testid="offline-notice"
                    role="status"
                >
                    {translate(
                        'You are offline. Cached results remain available; server actions are disabled.'
                    )}
                </div>
            )}
            {lifecycle.status === 'pending' && (
                <div
                    className={styles['working-list-initializing']}
                    data-testid="working-list-initializing"
                    aria-live="polite"
                >
                    <CircularLoader small />
                    <p>{translate('Loading the working list…')}</p>
                </div>
            )}
            {lifecycle.status === 'error' && (
                <div
                    className={styles['working-list-blocking-error']}
                    data-testid="working-list-lifecycle-error"
                >
                    <NoticeBox
                        error
                        title={translate('Could not load the working list')}
                    >
                        {translate(
                            'The working list could not be initialized for this program.'
                        )}
                    </NoticeBox>
                </div>
            )}
            <article
                className={`${styles['working-list-card']}${
                    blocked ? ` ${styles['working-list-card--blocked']}` : ''
                }`}
                data-testid="working-list"
                hidden={blocked}
            >
                {children}
            </article>
        </div>
    )
}
