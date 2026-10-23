import { CustomDataProvider } from '@dhis2/app-runtime'
import {
    focusManager,
    onlineManager,
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query'
import React, { useState } from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { profileWidgetQueryKeys } from '../../api/queryKeys'
import { useProfileWidgetClient } from '../../api/runtime'
import { trackedEntityRecordQueryOptions } from '../../data/queries'
import type { ProfileTrackedEntity } from '../../types'
import { ProfileWidgetDeleteDialog } from '../DeleteDialog'

/*
 * A profile that stays on screen after its tracked entity is deleted, run
 * against app-runtime's CustomDataProvider with the real record query
 * options, so TanStack's focus, reconnect and invalidation refetches are the
 * production ones.
 */

const activeEntity: ProfileTrackedEntity = {
    id: 'TrackedEnt1',
    programId: 'Program0001',
    trackedEntityTypeId: 'nEenWmSyUEp',
    trackedEntityTypeName: 'Person',
    orgUnitId: 'DiszpKrYNg8',
    inactive: false,
}

const storedRecord = {
    trackedEntity: 'TrackedEnt1',
    trackedEntityType: 'nEenWmSyUEp',
    orgUnit: 'DiszpKrYNg8',
    inactive: false,
    geometry: { type: 'Point', coordinates: [-11.4197, 8.1039] },
    potentialDuplicate: false,
    createdAtClient: '2020-01-02T03:04:05.678',
}

const recordKey = profileWidgetQueryKeys.trackedEntityRecord(
    'TrackedEnt1',
    'Program0001'
)
const changelogKey = profileWidgetQueryKeys.changelog('TrackedEnt1', {
    programId: 'Program0001',
    page: 1,
    pageSize: 10,
    attributeId: null,
    order: null,
})

type CustomData = React.ComponentProps<typeof CustomDataProvider>['data']

const setup = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(recordKey, { cached: true })
    queryClient.setQueryData(changelogKey, { cached: true })

    const data: CustomData = {
        'tracker/trackedEntities': async () => storedRecord,
        tracker: async () => ({
            status: 'OK',
            validationReport: { errorReports: [] },
        }),
    }
    const wrap = (children: React.ReactNode) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )

    return { queryClient, wrap }
}

describe('ProfileWidgetDeleteDialog with a mounted profile', () => {
    it('never refetches the deleted entity for a profile that is still mounted', async () => {
        const { queryClient, wrap } = setup()
        let recordFetches = 0

        // The real record query options (default staleTime, focus and
        // reconnect refetches on); only the fetch is counted.
        function RecordProbe({ renders }: { renders: number }) {
            const client = useProfileWidgetClient()
            const { data } = useQuery({
                ...trackedEntityRecordQueryOptions(client, {
                    trackedEntityId: 'TrackedEnt1',
                    programId: 'Program0001',
                }),
                queryFn: async () => {
                    recordFetches += 1
                    return {
                        ...storedRecord,
                        attributes: [],
                        fetches: recordFetches,
                    }
                },
            })
            return (
                <p data-testid="record">
                    {JSON.stringify(
                        data && 'fetches' in data
                            ? { fetches: data.fetches }
                            : data
                    )}{' '}
                    render {renders}
                </p>
            )
        }

        function Host() {
            const [open, setOpen] = useState(true)
            const [successes, setSuccesses] = useState(0)
            const [showProfile, setShowProfile] = useState(true)
            return (
                <>
                    {showProfile && <RecordProbe renders={successes} />}
                    <button type="button" onClick={() => setShowProfile(false)}>
                        Leave profile
                    </button>
                    <ProfileWidgetDeleteDialog
                        open={open}
                        onOpenChange={setOpen}
                        trackedEntity={activeEntity}
                        // Re-renders the profile instead of unmounting it.
                        onSuccess={() => setSuccesses((count) => count + 1)}
                    />
                </>
            )
        }

        await render(wrap(<Host />))
        // The stale cached record refetches once on mount, as in production.
        await expect
            .element(page.getByTestId('record'))
            .toHaveTextContent('{"fetches":1} render 0')
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Yes, delete Person' })
            .click()

        await expect
            .element(page.getByTestId('record'))
            .toHaveTextContent('{"fetches":1} render 1')
        expect(page.getByRole('alertdialog').query()).toBeNull()
        expect(queryClient.getQueryState(changelogKey)).toBeUndefined()

        try {
            // Window focus, reconnect and invalidation must not refetch it.
            focusManager.setFocused(false)
            focusManager.setFocused(true)
            onlineManager.setOnline(false)
            onlineManager.setOnline(true)
            await queryClient.invalidateQueries({
                queryKey: profileWidgetQueryKeys.all,
            })
            await new Promise((resolve) => setTimeout(resolve, 50))
        } finally {
            focusManager.setFocused(undefined)
            onlineManager.setOnline(true)
        }
        expect(recordFetches).toBe(1)
        await expect
            .element(page.getByTestId('record'))
            .toHaveTextContent('{"fetches":1} render 1')

        await page.getByRole('button', { name: 'Leave profile' }).click()

        await expect.element(page.getByTestId('record')).not.toBeInTheDocument()
        expect(queryClient.getQueryState(recordKey)).toBeUndefined()
        expect(recordFetches).toBe(1)
    })
})
