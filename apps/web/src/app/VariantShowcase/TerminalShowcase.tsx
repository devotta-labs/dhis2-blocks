import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
} from '@dhis2-blocks/working-list-terminal'
import React from 'react'
import { ShowcaseLayout, type ShowcaseTheme } from './ShowcaseLayout'

const theme: ShowcaseTheme = {
    page: 'bg-[#040705] font-mono text-emerald-300 [background-image:repeating-linear-gradient(180deg,rgb(16_185_129_/_4%)_0px,rgb(16_185_129_/_4%)_1px,transparent_1px,transparent_4px)]',
    kicker: 'text-[11px] uppercase tracking-[0.4em] text-emerald-600',
    title: 'mt-1 font-mono text-4xl font-normal tracking-tight text-emerald-300',
    tagline: 'mt-1 font-mono text-sm text-emerald-700',
    nav: 'flex flex-wrap items-center gap-1 border border-emerald-500/30 p-1',
    navActive:
        'bg-emerald-400 px-4 py-1.5 font-mono text-sm tracking-widest text-black no-underline',
    navIdle:
        'px-4 py-1.5 font-mono text-sm tracking-widest text-emerald-400 no-underline transition-colors hover:bg-emerald-400 hover:text-black',
    picker: 'flex flex-wrap items-center gap-6 font-mono text-xs text-emerald-600',
    select: 'max-w-[280px] cursor-pointer border border-emerald-500/40 bg-black px-2 py-1 font-mono text-xs text-emerald-300',
    status: 'font-mono text-sm text-emerald-600',
}

export const TerminalShowcase = () => (
    <ShowcaseLayout
        theme={theme}
        currentPath="/terminal"
        kicker="Variant 02"
        title="dhis2@tracker:~$"
        tagline="Monospace CRT console: numbered rows, bracketed commands, scanlines, invert-on-hover."
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
