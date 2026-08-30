import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
} from '@dhis2-blocks/working-list-aurora'
import React from 'react'
import { ShowcaseLayout, type ShowcaseTheme } from './ShowcaseLayout'

const theme: ShowcaseTheme = {
    page: 'bg-[#07061a] text-slate-200 [background-image:radial-gradient(circle_at_8%_-10%,rgb(34_211_238_/_22%),transparent_45%),radial-gradient(circle_at_92%_0%,rgb(232_121_249_/_18%),transparent_42%)]',
    kicker: 'text-[11px] font-semibold uppercase tracking-[0.4em] text-cyan-300/80',
    title: 'mt-1 bg-gradient-to-r from-cyan-200 via-white to-fuchsia-300 bg-clip-text text-4xl font-semibold tracking-tight text-transparent',
    tagline: 'mt-1 text-sm text-slate-400',
    nav: 'flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur',
    navActive:
        'rounded-full bg-[linear-gradient(90deg,rgb(34_211_238_/_35%),rgb(232_121_249_/_35%))] px-4 py-1.5 text-sm font-semibold text-white no-underline',
    navIdle:
        'rounded-full px-4 py-1.5 text-sm text-slate-300 no-underline transition-colors hover:bg-white/10 hover:text-white',
    picker: 'flex flex-wrap items-center gap-6 text-xs uppercase tracking-[0.18em] text-slate-400',
    select: 'h-8 max-w-[280px] cursor-pointer rounded-full border border-white/15 bg-white/5 px-3 text-xs normal-case tracking-normal text-cyan-100 backdrop-blur',
    status: 'text-sm text-slate-400',
}

export const AuroraShowcase = () => (
    <ShowcaseLayout
        theme={theme}
        currentPath="/aurora"
        kicker="Variant 01"
        title="Aurora"
        tagline="Dark glass surface, neon gradients, sticky translucent headers — same block, forked source."
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
