import React, { type ReactNode } from 'react'
import styles from '../WorkingList/WorkingList.module.css'

export interface WorkingListToolbarProps {
    children: ReactNode
}

export const WorkingListToolbar = ({ children }: WorkingListToolbarProps) => (
    <div
        className={styles['filter-actions-bar']}
        data-testid="working-list-toolbar"
    >
        {children}
    </div>
)
