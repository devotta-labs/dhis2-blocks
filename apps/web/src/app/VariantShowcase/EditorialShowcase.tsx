import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
} from '@dhis2-blocks/working-list-editorial'
import React from 'react'
import { ShowcaseLayout, type ShowcaseTheme } from './ShowcaseLayout'

const theme: ShowcaseTheme = {
    page: 'bg-[#f2ebdb] font-serif text-[#2f2a24]',
    kicker: 'font-serif text-[11px] uppercase tracking-[0.45em] text-[#8a3324]',
    title: 'mt-1 font-serif text-5xl font-normal tracking-tight text-[#1c1814]',
    tagline: 'mt-1 font-serif text-base italic text-[#6b5f52]',
    nav: 'flex flex-wrap items-center gap-5 border-y border-[#2f2a24] px-1 py-2',
    navActive:
        'font-serif text-sm uppercase tracking-[0.2em] text-[#8a3324] underline decoration-2 underline-offset-4',
    navIdle:
        'font-serif text-sm uppercase tracking-[0.2em] text-[#6b5f52] no-underline transition-colors hover:text-[#1c1814]',
    picker: 'flex flex-wrap items-center gap-6 font-serif text-[11px] uppercase tracking-[0.28em] text-[#6b5f52]',
    select: 'max-w-[280px] cursor-pointer border-0 border-b border-[#8a3324] bg-transparent px-1 py-1 font-serif text-sm normal-case tracking-normal text-[#2f2a24]',
    status: 'font-serif text-base italic text-[#6b5f52]',
}

export const EditorialShowcase = () => (
    <ShowcaseLayout
        theme={theme}
        currentPath="/editorial"
        kicker="Variant 03"
        title="The Tracker Review"
        tagline="Print-inspired: serif masthead, hairline rules, generous leading, typographic pagination."
    >
        {({ programId, orgUnitId }) => (
            <WorkingList programId={programId} orgUnitId={orgUnitId}>
                <WorkingListViewSwitcher />
                <WorkingListToolbar>
                    <WorkingListColumnSelector />
                    <WorkingListFilterControls />
                    <WorkingListToolbarActions />
                </WorkingListToolbar>
                <WorkingListTable dataQualityMode="highlighted" />
            </WorkingList>
        )}
    </ShowcaseLayout>
)
