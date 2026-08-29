'use client'

import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
} from '@dhis2-blocks/working-list'
import {
    WorkingListQueryClient,
    WorkingListQueryClientProvider,
    WorkingListRuntimeProvider,
} from '@dhis2-blocks/working-list/preview'
import { PreviewShell } from '@/components/previews/preview-shell'

const previewConfig = {
    apiVersion: 42,
    programId: 'IpHINAT79UW',
    orgUnitId: 'y77LiPqLMoq',
} as const

const queryClient = new WorkingListQueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: false,
            staleTime: 20_000,
        },
        mutations: { retry: false },
    },
})

export function WorkingListBasicPreview() {
    return (
        <WorkingListRuntimeProvider
            config={{
                baseUrl: `${window.location.origin}/api/dhis2`,
                apiVersion: previewConfig.apiVersion,
            }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <WorkingListQueryClientProvider client={queryClient}>
                <PreviewShell>
                    <WorkingList
                        programId={previewConfig.programId}
                        orgUnitId={previewConfig.orgUnitId}
                        defaultPagination={{ page: 1, pageSize: 10 }}
                    >
                        <WorkingListViewSwitcher />
                        <WorkingListToolbar>
                            <WorkingListColumnSelector />
                            <WorkingListFilterControls />
                            <WorkingListToolbarActions />
                        </WorkingListToolbar>
                        <WorkingListTable />
                    </WorkingList>
                </PreviewShell>
            </WorkingListQueryClientProvider>
        </WorkingListRuntimeProvider>
    )
}
