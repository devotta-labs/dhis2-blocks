import { QueryClient } from '@tanstack/react-query'
import type { ZodType } from 'zod'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type {
    DataEngineMutation,
    ResourceRequest,
    WorkingListClient,
} from '../../api/client'
import type { TrackerProgram } from '../../api/schemas'
import type { WorkingListSystemInfo } from '../../api/systemInfo'
import { WorkingList, type WorkingListProps } from '../WorkingList'

const PROGRAM_ID = 'Program0001'
const DEFAULT_LIST_ID = `${PROGRAM_ID}-default`
const MISSING_LIST_ID = 'MissingList01'

const program: TrackerProgram = {
    id: PROGRAM_ID,
    displayName: 'Test program',
    programType: 'WITH_REGISTRATION',
    programTrackedEntityAttributes: [
        {
            displayInList: true,
            trackedEntityAttribute: {
                id: 'Attribute01',
                displayName: 'Name',
                valueType: 'TEXT',
            },
        },
    ],
    programStages: [],
}

const systemInfo: WorkingListSystemInfo = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
    serverTimeZoneId: 'UTC',
}

interface ClientHarness {
    client: WorkingListClient
    requests: ResourceRequest[]
}

const createClientHarness = ({
    total = 0,
}: { total?: number } = {}): ClientHarness => {
    const requests: ResourceRequest[] = []
    const client: WorkingListClient = {
        async query<T>(request: ResourceRequest, schema: ZodType<T>) {
            requests.push(request)
            switch (request.resource) {
                case 'trackedEntityInstanceFilters':
                    return schema.parse({
                        trackedEntityInstanceFilters: [],
                    })
                case 'programStageWorkingLists':
                    return schema.parse({ programStageWorkingLists: [] })
                case 'tracker/trackedEntities':
                    return schema.parse({
                        trackedEntities: [],
                        pager: {
                            page: request.params?.page ?? 1,
                            pageSize: 15,
                            total,
                            pageCount: Math.ceil(total / 15),
                        },
                    })
                default:
                    throw new Error(`Unexpected query: ${request.resource}`)
            }
        },
        async mutate<T>(
            mutation: DataEngineMutation,
            _schema: ZodType<T>
        ): Promise<T> {
            throw new Error(
                `Unexpected mutation: ${mutation.type} ${mutation.resource}`
            )
        },
    }
    return { client, requests }
}

const waitForCondition = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        if (condition()) {
            return
        }
        await act(async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 0))
        })
    }
    throw new Error('Timed out waiting for the expected WorkingList state')
}

interface RenderHarness {
    container: HTMLDivElement
    queryClient: QueryClient
    render(selectedTemplateId?: string): void
    cleanup(): void
}

const createRenderHarness = (
    client: WorkingListClient,
    onSelectedTemplateChange: WorkingListProps['onSelectedTemplateChange']
): RenderHarness => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })
    const baseProps: Omit<WorkingListProps, 'selectedTemplateId'> = {
        apiVersion: 43,
        client,
        online: true,
        orgUnitId: 'OrgUnit0001',
        page: 1,
        pageSize: 15,
        program,
        queryClient,
        systemInfo,
        translate: (message) => message,
        onPageChange: () => undefined,
        onRowOpen: () => undefined,
        onSelectedTemplateChange,
        requestDiscardConfirmation: () => true,
    }

    return {
        container,
        queryClient,
        render(selectedTemplateId?: string) {
            act(() => {
                root.render(
                    <WorkingList
                        {...baseProps}
                        selectedTemplateId={selectedTemplateId}
                    />
                )
            })
        },
        cleanup() {
            act(() => root.unmount())
            queryClient.clear()
            container.remove()
        },
    }
}

const trackerRequestCount = (requests: ResourceRequest[]) =>
    requests.filter((request) => request.resource.startsWith('tracker/')).length

describe('WorkingList controlled selection', () => {
    const actEnvironment = globalThis
    let originalActEnvironment: boolean | undefined

    beforeEach(() => {
        originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    })

    afterEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    })

    it('preserves an unavailable selected id without querying records or changing selection', async () => {
        const { client, requests } = createClientHarness()
        const onSelectedTemplateChange =
            jest.fn<WorkingListProps['onSelectedTemplateChange']>()
        const harness = createRenderHarness(client, onSelectedTemplateChange)

        try {
            harness.render(MISSING_LIST_ID)
            await waitForCondition(
                () =>
                    harness.container.querySelector(
                        '[data-testid="unavailable-working-list-error"]'
                    ) !== null
            )

            expect(onSelectedTemplateChange).not.toHaveBeenCalled()
            expect(trackerRequestCount(requests)).toBe(0)
            expect(
                harness.container.querySelector(
                    '[data-testid="working-list-table"]'
                )
            ).toBeNull()
        } finally {
            harness.cleanup()
        }
    })

    it('moves to the default list only after the explicit recovery action', async () => {
        const { client, requests } = createClientHarness()
        const selectionChanges: Array<string | undefined> = []
        let harness: RenderHarness
        const onSelectedTemplateChange = jest.fn(
            (selectedTemplateId?: string) => {
                selectionChanges.push(selectedTemplateId)
                harness.render(selectedTemplateId)
            }
        )
        harness = createRenderHarness(client, onSelectedTemplateChange)

        try {
            harness.render(MISSING_LIST_ID)
            await waitForCondition(
                () =>
                    harness.container.querySelector(
                        '[data-test="use-default-working-list"]'
                    ) !== null
            )
            expect(selectionChanges).toEqual([])

            act(() => {
                harness.container
                    .querySelector<HTMLButtonElement>(
                        '[data-test="use-default-working-list"]'
                    )
                    ?.click()
            })

            await waitForCondition(
                () =>
                    harness.container.querySelector(
                        '[data-testid="working-list-table"]'
                    ) !== null
            )
            expect(selectionChanges).toEqual([DEFAULT_LIST_ID])
            expect(trackerRequestCount(requests)).toBe(1)
        } finally {
            harness.cleanup()
        }
    })

    it.each([
        ['the default id', DEFAULT_LIST_ID],
        ['an undefined id', undefined],
    ])('recovers when the host selects %s', async (_label, recoveredId) => {
        const { client, requests } = createClientHarness()
        const onSelectedTemplateChange =
            jest.fn<WorkingListProps['onSelectedTemplateChange']>()
        const harness = createRenderHarness(client, onSelectedTemplateChange)

        try {
            harness.render(MISSING_LIST_ID)
            await waitForCondition(
                () =>
                    harness.container.querySelector(
                        '[data-testid="unavailable-working-list-error"]'
                    ) !== null
            )
            onSelectedTemplateChange.mockClear()

            harness.render(recoveredId)
            await waitForCondition(
                () =>
                    harness.container.querySelector(
                        '[data-testid="working-list-table"]'
                    ) !== null
            )

            expect(trackerRequestCount(requests)).toBe(1)
            if (recoveredId === undefined) {
                expect(onSelectedTemplateChange).toHaveBeenCalledTimes(1)
                expect(onSelectedTemplateChange).toHaveBeenCalledWith(
                    DEFAULT_LIST_ID
                )
            } else {
                expect(onSelectedTemplateChange).not.toHaveBeenCalled()
            }
        } finally {
            harness.cleanup()
        }
    })

    it('prefetches the next page when the current page has more results', async () => {
        const { client, requests } = createClientHarness({ total: 30 })
        const harness = createRenderHarness(client, jest.fn())

        try {
            harness.render(DEFAULT_LIST_ID)
            await waitForCondition(() =>
                requests.some(
                    (request) =>
                        request.resource === 'tracker/trackedEntities' &&
                        request.params?.page === 2
                )
            )

            expect(
                requests
                    .filter(
                        (request) =>
                            request.resource === 'tracker/trackedEntities'
                    )
                    .map((request) => request.params?.page)
            ).toEqual([1, 2])
        } finally {
            harness.cleanup()
        }
    })
})
