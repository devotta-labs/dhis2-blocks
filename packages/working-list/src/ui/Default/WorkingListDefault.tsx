import React from 'react'
import type { WorkingListResultTarget } from '../../provider/contracts'
import { WorkingListActions } from '../Actions'
import { WorkingListColumns } from '../Columns'
import { WorkingListContainer } from '../Container'
import { WorkingListFilters } from '../Filters'
import { WorkingListResults } from '../Results'
import { WorkingListSavedViews } from '../SavedViews'
import { WorkingListSection } from '../Section'
import { WorkingListToolbar } from '../Toolbar'
import type { WorkingListDataQualityMode } from '../types'
import { useWorkingListText } from '../WorkingListText'

export interface WorkingListDefaultProps {
    onClick: (target: WorkingListResultTarget) => void
    dataQualityMode?: WorkingListDataQualityMode
}

export const WorkingListDefault = ({
    onClick,
    dataQualityMode = 'hidden',
}: WorkingListDefaultProps) => {
    const translate = useWorkingListText()

    return (
        <WorkingListContainer>
            <WorkingListSection
                title={translate('Saved views in this program')}
            >
                <WorkingListSavedViews />
            </WorkingListSection>
            <WorkingListSection ariaLabel={translate('Tracked entity filters')}>
                <WorkingListToolbar>
                    <WorkingListColumns />
                    <WorkingListFilters />
                    <WorkingListActions />
                </WorkingListToolbar>
            </WorkingListSection>
            <WorkingListSection ariaLabel={translate('Working list results')}>
                <WorkingListResults
                    onClick={onClick}
                    dataQualityMode={dataQualityMode}
                />
            </WorkingListSection>
        </WorkingListContainer>
    )
}
