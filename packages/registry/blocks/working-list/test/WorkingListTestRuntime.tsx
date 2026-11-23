import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentProps, ReactNode } from 'react'
import { onTestFinished } from 'vitest'
import { z } from 'zod'

export type WorkingListTestData = ComponentProps<
    typeof CustomDataProvider
>['data']

export const WORKING_LIST_PROGRAM = 'Program0001'
const SAVED_LIST_ID = 'SavedList01'
const program = {
    id: WORKING_LIST_PROGRAM,
    displayName: 'Child programme',
    programType: 'WITH_REGISTRATION',
    programTrackedEntityAttributes: [],
    programStages: [],
}

const CreateSavedListSchema = z
    .object({ name: z.string(), entityQueryCriteria: z.json() })
    .passthrough()

export const readyWorkingListData = () => {
    const created: Array<{
        id: string
        displayName: string
        program: { id: string }
        entityQueryCriteria: z.infer<
            typeof CreateSavedListSchema
        >['entityQueryCriteria']
    }> = []
    const data: WorkingListTestData = {
        'system/info': {
            calendar: 'gregorian',
            dateFormat: 'YYYY-MM-DD',
            serverTimeZoneId: 'UTC',
        },
        programs: program,
        programStageWorkingLists: { programStageWorkingLists: [] },
        'tracker/trackedEntities': { trackedEntities: [] },
        async trackedEntityInstanceFilters(type, { data: payload }) {
            if (type === 'read') {
                return z.json().parse({ trackedEntityInstanceFilters: created })
            }
            if (type !== 'create') {
                throw new Error(`Unsupported saved-list request: ${type}`)
            }
            const { name, entityQueryCriteria } =
                CreateSavedListSchema.parse(payload)
            created.push({
                id: SAVED_LIST_ID,
                displayName: name,
                program: { id: WORKING_LIST_PROGRAM },
                entityQueryCriteria,
            })
            return z.json().parse({
                status: 'OK',
                response: { uid: SAVED_LIST_ID },
            })
        },
    }
    return { data, created, program }
}

export const workingListTestQueryClient = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    onTestFinished(() => client.clear())
    return client
}

export const WorkingListTestRuntime = ({
    children,
    client,
    data,
}: {
    children: ReactNode
    client: QueryClient
    data: WorkingListTestData
}) => (
    <Provider
        config={{ baseUrl: window.location.origin, apiVersion: 43 }}
        userInfo={undefined}
        plugin={false}
        parentAlertsAdd={undefined}
        showAlertsInPlugin={false}
    >
        <CustomDataProvider data={data}>
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    </Provider>
)
