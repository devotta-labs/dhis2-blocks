import {
    functionalUpdate,
    type OnChangeFn,
    type PaginationState,
    type SortingState,
} from '@tanstack/react-table'
import { StrictMode, useState, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import {
    PatientListRequestError,
    usePatientList,
    type PatientListController,
    type PatientListFilterQuery,
} from '..'
import {
    FIRST_NAME,
    ORG_UNIT,
    OTHER_ORG_UNIT,
    OTHER_PROGRAM,
    PROGRAM,
    PatientListProviders,
    createFakeServer,
    requestsFiltering,
    testColumns,
    testFilters,
    type FakeServer,
} from './patientListTestSupport'

const providers =
    (server: FakeServer, strict = false) =>
    ({ children }: { children: ReactNode }) => {
        const content = (
            <PatientListProviders server={server}>
                {children}
            </PatientListProviders>
        )
        return strict ? <StrictMode>{content}</StrictMode> : content
    }

const ready = async (read: () => PatientListController) => {
    await expect.poll(() => read().status).toBe('ready')
}

const rowIds = (list: PatientListController) =>
    list.table.getRowModel().rows.map((row) => row.id)

const pause = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))

const amina = {
    id: FIRST_NAME,
    value: { kind: 'text', operator: 'contains', text: 'amina' },
}
const byFirstName: SortingState = [{ id: FIRST_NAME, desc: true }]
const activeOnly: PatientListFilterQuery = { enrollmentStatus: 'ACTIVE' }
const enrolledFirst = ['enrolledAt:asc']

describe('usePatientList: the query', () => {
    it('starts on the first page of 15, newest first', async () => {
        const server = createFakeServer()
        const { result } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                }),
            { wrapper: providers(server) }
        )
        expect(result.current.query).toEqual({
            program: PROGRAM,
            orgUnit: ORG_UNIT,
            page: 1,
            pageSize: 15,
            order: ['createdAt:desc'],
        })
        await ready(() => result.current)
        expect(rowIds(result.current)).toHaveLength(15)
        expect(rowIds(result.current)[0]).toBe('te01')
        expect(result.current.hasNextPage).toBe(true)
        expect(result.current.table.state.pagination).toEqual({
            pageIndex: 0,
            pageSize: 15,
        })
    })

    it('starts the slices it owns from initialState', async () => {
        const server = createFakeServer()
        const { result } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                    filters: testFilters,
                    initialState: {
                        sorting: byFirstName,
                        columnFilters: [amina],
                        pagination: { pageIndex: 1, pageSize: 2 },
                    },
                }),
            { wrapper: providers(server) }
        )
        expect(result.current.query).toMatchObject({
            page: 2,
            pageSize: 2,
            order: [`${FIRST_NAME}:desc`],
            filters: [`${FIRST_NAME}:like:amina`],
        })
        await ready(() => result.current)
        expect(rowIds(result.current)).toEqual(['te12', 'te01'])
        expect(server.requests).toHaveLength(1)
    })

    it('sends the base query and the default order', async () => {
        const server = createFakeServer()
        const { result } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    orgUnitMode: 'DESCENDANTS',
                    columns: testColumns,
                    baseQuery: activeOnly,
                    defaultOrder: enrolledFirst,
                }),
            { wrapper: providers(server) }
        )
        await ready(() => result.current)
        expect(server.requests[0]).toMatchObject({
            orgUnitMode: 'DESCENDANTS',
            enrollmentStatus: 'ACTIVE',
            order: 'enrolledAt:asc',
        })
    })

    it('keeps the same query while nothing changes', async () => {
        const server = createFakeServer()
        const { result, rerender } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                    filters: testFilters,
                }),
            { wrapper: providers(server) }
        )
        await ready(() => result.current)
        const first = result.current.query
        await rerender()
        expect(result.current.query).toBe(first)
    })

    it('returns to the first page in the same request when sorting or filters change', async () => {
        const server = createFakeServer()
        const { result, act } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                    filters: testFilters,
                }),
            { wrapper: providers(server) }
        )
        await ready(() => result.current)
        await act(() => result.current.table.setPageIndex(1))
        await ready(() => result.current)
        expect(result.current.query.page).toBe(2)

        await act(() =>
            result.current.table.setSorting([{ id: FIRST_NAME, desc: false }])
        )
        expect(result.current.query).toMatchObject({
            page: 1,
            order: [`${FIRST_NAME}:asc`],
        })
        await ready(() => result.current)
        const sorted = server.requests.filter(
            (params) => params.order === `${FIRST_NAME}:asc`
        )
        expect(sorted.map((params) => params.page)).toEqual([1])

        await act(() => result.current.table.setPageIndex(1))
        await ready(() => result.current)
        await act(() => result.current.table.setColumnFilters([amina]))
        expect(result.current.query.page).toBe(1)
        await ready(() => result.current)
        const filtered = requestsFiltering(server, `${FIRST_NAME}:like:amina`)
        expect(filtered.map((params) => params.page)).toEqual([1])
    })
})

describe('usePatientList: slices the caller controls', () => {
    it('reads the caller state and reports changes to the caller', async () => {
        const server = createFakeServer()
        const onSortingChange = vi.fn<OnChangeFn<SortingState>>()
        const { result, act } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                    state: { sorting: byFirstName },
                    onSortingChange,
                }),
            { wrapper: providers(server) }
        )
        expect(result.current.query.order).toEqual([`${FIRST_NAME}:desc`])
        await ready(() => result.current)

        await act(() =>
            result.current.table.setSorting([{ id: FIRST_NAME, desc: false }])
        )
        expect(onSortingChange).toHaveBeenCalledTimes(1)
        // The caller did not take the change, so the query stays.
        expect(result.current.query.order).toEqual([`${FIRST_NAME}:desc`])
    })

    it('requests a deep-linked page as given, also in StrictMode', async () => {
        const server = createFakeServer()
        const onPaginationChange = vi.fn<OnChangeFn<PaginationState>>()
        const { result } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                    state: { pagination: { pageIndex: 3, pageSize: 10 } },
                    onPaginationChange,
                }),
            { wrapper: providers(server, true) }
        )
        await ready(() => result.current)
        expect(result.current.query).toMatchObject({ page: 4, pageSize: 10 })
        expect(rowIds(result.current)[0]).toBe('te31')
        expect(server.requests.length).toBeGreaterThan(0)
        expect(server.requests.filter((params) => params.page !== 4)).toEqual(
            []
        )
        expect(onPaginationChange).not.toHaveBeenCalled()
    })

    it('asks the caller for the first page when the program changes', async () => {
        const server = createFakeServer()
        const changes: PaginationState[] = []
        let program = PROGRAM
        const { result, rerender } = await renderHook(
            () => {
                const [pagination, setPagination] = useState<PaginationState>({
                    pageIndex: 3,
                    pageSize: 10,
                })
                const list = usePatientList({
                    program,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                    state: { pagination },
                    onPaginationChange: (updater) => {
                        const next = functionalUpdate(updater, pagination)
                        changes.push(next)
                        setPagination(next)
                    },
                })
                return list
            },
            { wrapper: providers(server, true) }
        )
        await ready(() => result.current)
        expect(result.current.query.page).toBe(4)

        program = OTHER_PROGRAM
        await rerender()
        await expect.poll(() => result.current.query.page).toBe(1)
        expect(changes).toEqual([{ pageIndex: 0, pageSize: 10 }])
        await ready(() => result.current)

        // Already on the first page: nothing to ask for.
        program = PROGRAM
        await rerender()
        await ready(() => result.current)
        expect(changes).toHaveLength(1)
    })
})

describe('usePatientList: a new program or organisation unit', () => {
    it('returns to the first page with no request for the old page', async () => {
        const server = createFakeServer()
        let program = PROGRAM
        let orgUnit = ORG_UNIT
        const { result, rerender, act } = await renderHook(
            () =>
                usePatientList({
                    program,
                    orgUnit,
                    columns: testColumns,
                }),
            { wrapper: providers(server) }
        )
        await ready(() => result.current)
        await act(() => result.current.table.setPageIndex(2))
        await ready(() => result.current)
        expect(result.current.query.page).toBe(3)

        program = OTHER_PROGRAM
        await rerender()
        expect(result.current.query).toMatchObject({
            program: OTHER_PROGRAM,
            page: 1,
        })
        await ready(() => result.current)
        expect(
            server.requests
                .filter((params) => params.program === OTHER_PROGRAM)
                .map((params) => params.page)
        ).toEqual([1])

        await act(() => result.current.table.setPageIndex(1))
        await ready(() => result.current)
        orgUnit = OTHER_ORG_UNIT
        await rerender()
        expect(result.current.query).toMatchObject({
            orgUnit: OTHER_ORG_UNIT,
            page: 1,
        })
        await ready(() => result.current)
        expect(
            server.requests
                .filter((params) => params.orgUnits === OTHER_ORG_UNIT)
                .map((params) => params.page)
        ).toEqual([1])
    })

    it('clears the selection, but not on mount', async () => {
        const server = createFakeServer()
        let program = PROGRAM
        const { result, rerender, act } = await renderHook(
            () =>
                usePatientList({
                    program,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                    initialState: { rowSelection: { te02: true } },
                }),
            { wrapper: providers(server, true) }
        )
        await ready(() => result.current)
        expect(result.current.table.state.rowSelection).toEqual({ te02: true })

        await act(() => result.current.table.setRowSelection({ te03: true }))
        expect(result.current.table.state.rowSelection).toEqual({ te03: true })

        program = OTHER_PROGRAM
        await rerender()
        await expect
            .poll(() => result.current.table.state.rowSelection)
            .toEqual({})
    })
})

describe('usePatientList: status', () => {
    it('is loading until the first page arrives', async () => {
        const server = createFakeServer()
        server.held = true
        const { result } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                }),
            { wrapper: providers(server) }
        )
        expect(result.current.status).toBe('loading')
        expect(rowIds(result.current)).toEqual([])
        server.held = false
        server.release()
        await ready(() => result.current)
    })

    it('is updating while the next page loads, and shows the last one', async () => {
        const server = createFakeServer()
        const { result, act } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                }),
            { wrapper: providers(server) }
        )
        await ready(() => result.current)
        server.held = true
        await act(() => result.current.table.setPageIndex(1))
        await expect.poll(() => result.current.status).toBe('updating')
        expect(rowIds(result.current)[0]).toBe('te01')

        server.held = false
        server.release()
        await ready(() => result.current)
        expect(rowIds(result.current)[0]).toBe('te16')
    })

    it('is an error with the server message, and refetch recovers', async () => {
        const server = createFakeServer()
        server.failure = 'You have no access to this program'
        const { result, act } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                }),
            { wrapper: providers(server) }
        )
        await expect.poll(() => result.current.status).toBe('error')
        const error = result.current.error
        expect(error).toBeInstanceOf(PatientListRequestError)
        expect(error).toMatchObject({
            status: 409,
            serverMessage: 'You have no access to this program',
        })
        expect(result.current.hasNextPage).toBe(false)
        // A client error is not retried.
        expect(server.requests).toHaveLength(1)

        server.failure = undefined
        await act(() => result.current.refetch())
        await ready(() => result.current)
        expect(result.current.error).toBeNull()
        expect(rowIds(result.current)).toHaveLength(15)
    })

    it('is ready with no rows and no request when disabled', async () => {
        const server = createFakeServer()
        const { result } = await renderHook(
            () =>
                usePatientList({
                    program: PROGRAM,
                    orgUnit: ORG_UNIT,
                    columns: testColumns,
                    enabled: false,
                }),
            { wrapper: providers(server) }
        )
        expect(result.current.status).toBe('ready')
        await pause()
        expect(rowIds(result.current)).toEqual([])
        expect(result.current.hasNextPage).toBe(false)
        expect(server.requests).toEqual([])
    })
})
