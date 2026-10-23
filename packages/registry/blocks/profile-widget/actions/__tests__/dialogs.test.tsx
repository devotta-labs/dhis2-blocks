import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { profileWidgetQueryKeys } from '../../api/queryKeys'
import type { ProfileTrackedEntity } from '../../types'
import { ProfileWidgetDeleteDialog } from '../DeleteDialog'
import { ProfileWidgetStatusDialog } from '../StatusDialog'

/*
 * The dialogs run against app-runtime's CustomDataProvider, so the real
 * engine client, TanStack mutation and cache updates are exercised without
 * mocking any module.
 */

const activeEntity: ProfileTrackedEntity = {
    id: 'TrackedEnt1',
    programId: 'Program0001',
    trackedEntityTypeId: 'nEenWmSyUEp',
    trackedEntityTypeName: 'Person',
    orgUnitId: 'DiszpKrYNg8',
    inactive: false,
}

const inactiveEntity: ProfileTrackedEntity = { ...activeEntity, inactive: true }

const storedRecord = {
    trackedEntity: 'TrackedEnt1',
    trackedEntityType: 'nEenWmSyUEp',
    orgUnit: 'DiszpKrYNg8',
    inactive: false,
    geometry: { type: 'Point', coordinates: [-11.4197, 8.1039] },
    potentialDuplicate: false,
    createdAtClient: '2020-01-02T03:04:05.678',
}

const okReport = { status: 'OK', validationReport: { errorReports: [] } }

const rejection = (...messages: string[]) =>
    new FetchError({
        type: 'access',
        message: 'Forbidden',
        details: {
            status: 'ERROR',
            validationReport: {
                errorReports: messages.map((message) => ({
                    message,
                    errorCode: 'E1000',
                    trackerType: 'TRACKED_ENTITY',
                    uid: 'TrackedEnt1',
                })),
            },
        },
    })

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
const systemInfoKey = profileWidgetQueryKeys.systemInfo()

type CustomData = React.ComponentProps<typeof CustomDataProvider>['data']
type CustomResourceFactory = Extract<
    CustomData[string],
    (...args: never[]) => object
>
type ImportResponse = Awaited<ReturnType<CustomResourceFactory>>

interface Imports {
    /** Bodies posted to `tracker`, with their params */
    posts: { params: unknown; data: unknown }[]
}

const setup = (importResponse: () => Promise<ImportResponse>) => {
    const imports: Imports = { posts: [] }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(recordKey, { cached: true })
    queryClient.setQueryData(changelogKey, { cached: true })
    queryClient.setQueryData(systemInfoKey, { cached: true })

    const data: CustomData = {
        'tracker/trackedEntities': async () => storedRecord,
        tracker: async (_type, query) => {
            imports.posts.push({ params: query.params, data: query.data })
            return importResponse()
        },
    }
    const wrap = (children: ReactNode) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )

    return { imports, queryClient, wrap }
}

const deferred = () => {
    let resolve: (value: ImportResponse) => void = () => undefined
    const promise = new Promise<ImportResponse>((settle) => {
        resolve = settle
    })
    return { promise, resolve }
}

const callOrder = () => {
    const calls: string[] = []
    return {
        calls,
        onOpenChange: vi.fn((open: boolean) => {
            calls.push(`onOpenChange(${open})`)
        }),
        onSuccess: vi.fn((...args: unknown[]) => {
            calls.push(`onSuccess(${args.map(String).join(',')})`)
        }),
    }
}

describe('ProfileWidgetStatusDialog', () => {
    it('deactivates with the echoed payload, invalidates the entity, then closes and reports success', async () => {
        const { imports, queryClient, wrap } = setup(async () => okReport)
        const { calls, onOpenChange, onSuccess } = callOrder()

        await render(
            wrap(
                <ProfileWidgetStatusDialog
                    open
                    onOpenChange={onOpenChange}
                    trackedEntity={activeEntity}
                    onSuccess={onSuccess}
                />
            )
        )

        const dialog = page.getByRole('alertdialog')
        await expect
            .element(dialog.getByRole('heading', { name: 'Deactivate Person' }))
            .toBeVisible()
        await expect
            .element(dialog)
            .toHaveTextContent(
                'Are you sure you want to deactivate this Person? This will change its status to inactive and only read operations will be allowed.'
            )
        await expect
            .element(dialog.getByRole('button', { name: 'No, cancel' }))
            .toBeVisible()
        const confirm = dialog.getByRole('button', {
            name: 'Yes, deactivate Person',
        })
        expect(confirm.element().className).toContain('dhis2-red')

        await confirm.click()

        await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(calls).toEqual(['onOpenChange(false)', 'onSuccess(true)'])
        expect(imports.posts).toHaveLength(1)
        expect(imports.posts[0].params).toEqual({
            async: false,
            importStrategy: 'UPDATE',
        })
        expect(imports.posts[0].data).toMatchObject({
            trackedEntities: [
                {
                    trackedEntity: 'TrackedEnt1',
                    trackedEntityType: 'nEenWmSyUEp',
                    orgUnit: 'DiszpKrYNg8',
                    inactive: true,
                    geometry: storedRecord.geometry,
                    potentialDuplicate: false,
                    createdAtClient: '2020-01-02T03:04:05.678',
                },
            ],
        })
        expect(queryClient.getQueryState(recordKey)?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState(changelogKey)?.isInvalidated).toBe(
            true
        )
        expect(queryClient.getQueryState(systemInfoKey)?.isInvalidated).toBe(
            false
        )
    })

    it('offers activation with a primary button for an inactive entity', async () => {
        const { imports, wrap } = setup(async () => okReport)
        const { calls, onOpenChange, onSuccess } = callOrder()

        await render(
            wrap(
                <ProfileWidgetStatusDialog
                    open
                    onOpenChange={onOpenChange}
                    trackedEntity={inactiveEntity}
                    onSuccess={onSuccess}
                />
            )
        )

        const dialog = page.getByRole('alertdialog')
        await expect
            .element(dialog.getByRole('heading', { name: 'Activate Person' }))
            .toBeVisible()
        const confirm = dialog.getByRole('button', {
            name: 'Yes, activate Person',
        })
        expect(confirm.element().className).not.toContain('dhis2-red')

        await confirm.click()

        await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(calls).toEqual(['onOpenChange(false)', 'onSuccess(false)'])
        expect(imports.posts[0].data).toMatchObject({
            trackedEntities: [{ inactive: false }],
        })
    })

    it('lists tracker error reports and stays open', async () => {
        const { queryClient, wrap } = setup(async () => {
            throw rejection(
                'User has no write access to TrackedEntityType',
                'Second report'
            )
        })
        const { onOpenChange, onSuccess } = callOrder()

        await render(
            wrap(
                <ProfileWidgetStatusDialog
                    open
                    onOpenChange={onOpenChange}
                    trackedEntity={activeEntity}
                    onSuccess={onSuccess}
                />
            )
        )

        const dialog = page.getByRole('alertdialog')
        await dialog
            .getByRole('button', { name: 'Yes, deactivate Person' })
            .click()

        const alert = dialog.getByRole('alert')
        await expect
            .element(alert)
            .toHaveTextContent('There was a problem deactivating the Person')
        expect(
            alert
                .getByRole('listitem')
                .elements()
                .map((item) => item.textContent)
        ).toEqual([
            'User has no write access to TrackedEntityType',
            'Second report',
        ])
        await expect.element(dialog).toBeVisible()
        await expect
            .element(
                dialog.getByRole('button', { name: 'Yes, deactivate Person' })
            )
            .toBeEnabled()
        expect(onOpenChange).not.toHaveBeenCalled()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(queryClient.getQueryState(recordKey)?.isInvalidated).toBe(false)
    })

    it('cannot be dismissed while the import is pending', async () => {
        const pending = deferred()
        const { wrap } = setup(() => pending.promise)
        const { calls, onOpenChange, onSuccess } = callOrder()

        await render(
            wrap(
                <ProfileWidgetStatusDialog
                    open
                    onOpenChange={onOpenChange}
                    trackedEntity={activeEntity}
                    onSuccess={onSuccess}
                />
            )
        )

        const dialog = page.getByRole('alertdialog')
        const confirm = dialog.getByRole('button', {
            name: 'Yes, deactivate Person',
        })
        await confirm.click()

        await expect.element(confirm).toBeDisabled()
        await expect
            .element(dialog.getByRole('button', { name: 'No, cancel' }))
            .toBeDisabled()
        await userEvent.keyboard('{Escape}')
        expect(onOpenChange).not.toHaveBeenCalled()

        pending.resolve(okReport)

        await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(calls).toEqual(['onOpenChange(false)', 'onSuccess(true)'])
    })

    it('sends one import when confirm is clicked twice before it re-renders', async () => {
        const pending = deferred()
        const { imports, wrap } = setup(() => pending.promise)
        const onSuccess = vi.fn()

        await render(
            wrap(
                <ProfileWidgetStatusDialog
                    open
                    onOpenChange={vi.fn()}
                    trackedEntity={activeEntity}
                    onSuccess={onSuccess}
                />
            )
        )

        const confirm = page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Yes, deactivate Person' })
            .element()
        if (!(confirm instanceof HTMLButtonElement)) {
            throw new Error('Expected the confirm button')
        }
        confirm.click()
        confirm.click()

        // Both imports would read the record first, then post.
        await vi.waitFor(() => expect(imports.posts).toHaveLength(1))
        pending.resolve(okReport)
        await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
        expect(imports.posts).toHaveLength(1)
    })

    it('closes through "No, cancel" without importing', async () => {
        const { imports, wrap } = setup(async () => okReport)
        const { onOpenChange, onSuccess } = callOrder()

        await render(
            wrap(
                <ProfileWidgetStatusDialog
                    open
                    onOpenChange={onOpenChange}
                    trackedEntity={activeEntity}
                    onSuccess={onSuccess}
                />
            )
        )

        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'No, cancel' })
            .click()

        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(onSuccess).not.toHaveBeenCalled()
        expect(imports.posts).toHaveLength(0)
    })

    it('clears a previous error when it is opened again', async () => {
        const { wrap } = setup(async () => {
            throw rejection('Rejected')
        })
        const onOpenChange = vi.fn()
        const dialog = (open: boolean) =>
            wrap(
                <ProfileWidgetStatusDialog
                    open={open}
                    onOpenChange={onOpenChange}
                    trackedEntity={activeEntity}
                />
            )

        const screen = await render(dialog(true))
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Yes, deactivate Person' })
            .click()
        await expect
            .element(page.getByRole('alertdialog').getByRole('alert'))
            .toBeVisible()

        await screen.rerender(dialog(false))
        await expect
            .element(page.getByRole('alertdialog'))
            .not.toBeInTheDocument()
        await screen.rerender(dialog(true))

        await expect.element(page.getByRole('alertdialog')).toBeVisible()
        expect(
            page.getByRole('alertdialog').getByRole('alert').elements()
        ).toHaveLength(0)
    })
})

describe('ProfileWidgetDeleteDialog', () => {
    it('deletes, removes the entity queries without refetching, then closes and reports success', async () => {
        const { imports, queryClient, wrap } = setup(async () => okReport)
        const { calls, onOpenChange, onSuccess } = callOrder()

        await render(
            wrap(
                <ProfileWidgetDeleteDialog
                    open
                    onOpenChange={onOpenChange}
                    trackedEntity={activeEntity}
                    onSuccess={onSuccess}
                />
            )
        )

        const dialog = page.getByRole('alertdialog')
        await expect
            .element(dialog.getByRole('heading', { name: 'Delete Person' }))
            .toBeVisible()
        await expect
            .element(dialog)
            .toHaveTextContent(
                'Are you sure you want to delete this Person? This will permanently remove the Person and all its associated enrollments and events in all programs.'
            )
        const confirm = dialog.getByRole('button', {
            name: 'Yes, delete Person',
        })
        expect(confirm.element().className).toContain('dhis2-red')

        await confirm.click()

        await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled())
        expect(calls).toEqual(['onOpenChange(false)', 'onSuccess()'])
        expect(imports.posts).toEqual([
            {
                params: { async: false, importStrategy: 'DELETE' },
                data: { trackedEntities: [{ trackedEntity: 'TrackedEnt1' }] },
            },
        ])
        expect(queryClient.getQueryState(recordKey)).toBeUndefined()
        expect(queryClient.getQueryState(changelogKey)).toBeUndefined()
        expect(queryClient.getQueryData(systemInfoKey)).toEqual({
            cached: true,
        })
    })

    it('sends one import when confirm is clicked twice before it re-renders', async () => {
        const pending = deferred()
        const { imports, wrap } = setup(() => pending.promise)
        const onSuccess = vi.fn()

        await render(
            wrap(
                <ProfileWidgetDeleteDialog
                    open
                    onOpenChange={vi.fn()}
                    trackedEntity={activeEntity}
                    onSuccess={onSuccess}
                />
            )
        )

        const confirm = page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Yes, delete Person' })
            .element()
        if (!(confirm instanceof HTMLButtonElement)) {
            throw new Error('Expected the confirm button')
        }
        confirm.click()
        confirm.click()

        await vi.waitFor(() => expect(imports.posts).toHaveLength(1))
        pending.resolve(okReport)
        await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
        expect(imports.posts).toHaveLength(1)
    })

    it('uses the program terminology for the cascade warning', async () => {
        const { wrap } = setup(async () => okReport)
        await render(
            wrap(
                <ProfileWidgetDeleteDialog
                    open
                    onOpenChange={vi.fn()}
                    trackedEntity={activeEntity}
                    labels={{ enrollments: 'Cases', events: 'Visits' }}
                    onSuccess={vi.fn()}
                />
            )
        )
        await expect
            .element(page.getByRole('alertdialog'))
            .toHaveTextContent(
                'This will permanently remove the Person and all its associated Cases and Visits in all programs.'
            )
    })

    it('keeps the dialog and the cache when the import is rejected', async () => {
        const { queryClient, wrap } = setup(async () => {
            throw rejection('F_TEI_CASCADE_DELETE is required')
        })
        const { onOpenChange, onSuccess } = callOrder()

        await render(
            wrap(
                <ProfileWidgetDeleteDialog
                    open
                    onOpenChange={onOpenChange}
                    trackedEntity={activeEntity}
                    onSuccess={onSuccess}
                />
            )
        )

        const dialog = page.getByRole('alertdialog')
        await dialog.getByRole('button', { name: 'Yes, delete Person' }).click()

        const alert = dialog.getByRole('alert')
        await expect
            .element(alert)
            .toHaveTextContent('There was a problem deleting the Person')
        await expect
            .element(alert)
            .toHaveTextContent('F_TEI_CASCADE_DELETE is required')
        expect(onOpenChange).not.toHaveBeenCalled()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(queryClient.getQueryData(recordKey)).toEqual({ cached: true })
    })

    it('does not HTML-escape the tracked entity type name', async () => {
        const { wrap } = setup(async () => okReport)

        await render(
            wrap(
                <ProfileWidgetDeleteDialog
                    open
                    onOpenChange={vi.fn()}
                    trackedEntity={{
                        ...activeEntity,
                        trackedEntityTypeName: 'Mother & child',
                    }}
                    onSuccess={vi.fn()}
                />
            )
        )

        const dialog = page.getByRole('alertdialog')
        await expect
            .element(
                dialog.getByRole('heading', { name: 'Delete Mother & child' })
            )
            .toBeVisible()
        await expect
            .element(
                dialog.getByRole('button', {
                    name: 'Yes, delete Mother & child',
                })
            )
            .toBeVisible()
    })

    it('shows the request failure message when there are no error reports', async () => {
        const { wrap } = setup(async () => {
            throw new FetchError({
                type: 'unknown',
                message:
                    'An unknown error occurred - Internal Server Error (500)',
                details: { httpStatusCode: 500 },
            })
        })

        await render(
            wrap(
                <ProfileWidgetDeleteDialog
                    open
                    onOpenChange={vi.fn()}
                    trackedEntity={activeEntity}
                    onSuccess={vi.fn()}
                />
            )
        )

        const dialog = page.getByRole('alertdialog')
        await dialog.getByRole('button', { name: 'Yes, delete Person' }).click()

        await expect
            .element(dialog.getByRole('alert'))
            .toHaveTextContent(
                'An unknown error occurred - Internal Server Error (500)'
            )
    })
})
