import {
    keepPreviousData,
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { Label } from '@/components/dhis2/ui/label'
import {
    createDataTableColumnHelper,
    DataTable,
    DataTableContent,
    DataTableFilters,
    DataTablePagination,
    DataTableSearch,
    DataTableToolbar,
    parseDataTableFilterValue,
    useDataTable,
    type DataTableFilter,
    type DataTableState,
    type DataTableStatus,
} from '@/components/data-table'
import { useState } from 'react'
import { facilities, type Facility } from './facilities'

interface FacilityQuery {
    pageIndex: number
    pageSize: number
    sorting: DataTableState['sorting']
    columnFilters: DataTableState['columnFilters']
    globalFilter: string
}

const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

const sortValue = (facility: Facility, columnId: string) => {
    switch (columnId) {
        case 'district':
            return facility.district
        case 'type':
            return facility.type
        case 'beds':
            return facility.beds
        default:
            return facility.name
    }
}

/** Stands in for a server: filters, sorts and slices the facilities. */
const fetchFacilities = async ({
    pageIndex,
    pageSize,
    sorting,
    columnFilters,
    globalFilter,
}: FacilityQuery) => {
    await wait(400)
    const search = globalFilter.trim().toLowerCase()
    let rows = facilities.filter((facility) =>
        facility.name.toLowerCase().includes(search)
    )
    for (const entry of columnFilters) {
        const value = parseDataTableFilterValue(entry)
        if (entry.id !== 'district' || value?.kind !== 'text') continue
        const text = value.text.trim().toLowerCase()
        rows = rows.filter((facility) =>
            facility.district.toLowerCase().includes(text)
        )
    }
    const [sort] = sorting
    if (sort !== undefined) {
        const direction = sort.desc ? -1 : 1
        rows = [...rows].sort((a, b) => {
            const left = sortValue(a, sort.id)
            const right = sortValue(b, sort.id)
            if (left === right) return 0
            return left < right ? -direction : direction
        })
    }
    const start = pageIndex * pageSize
    return { rows: rows.slice(start, start + pageSize), total: rows.length }
}

const filters: DataTableFilter[] = [
    { id: 'district', kind: 'text', label: 'District', pinned: true },
]

const column = createDataTableColumnHelper<Facility>()

const columns = column.columns([
    column.accessor('name', { header: 'Name' }),
    column.accessor('district', { header: 'District' }),
    column.accessor('type', { header: 'Type' }),
    column.accessor('beds', { header: 'Beds', meta: { align: 'end' } }),
])

const noRows: Facility[] = []

const statusOf = ({
    isError,
    isPending,
    isFetching,
}: {
    isError: boolean
    isPending: boolean
    isFetching: boolean
}): DataTableStatus => {
    if (isError) return 'error'
    if (isPending) return 'loading'
    if (isFetching) return 'updating'
    return 'ready'
}

const ServerFacilities = () => {
    const [sorting, setSorting] = useState<DataTableState['sorting']>([])
    const [columnFilters, setColumnFilters] = useState<
        DataTableState['columnFilters']
    >([])
    const [globalFilter, setGlobalFilter] = useState('')
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
    const [failNext, setFailNext] = useState(false)

    const params: FacilityQuery = {
        ...pagination,
        sorting,
        columnFilters,
        globalFilter,
    }
    const query = useQuery({
        queryKey: ['facilities', params],
        queryFn: async () => {
            if (!failNext) return fetchFacilities(params)
            setFailNext(false)
            await wait(400)
            throw new Error('The server did not answer.')
        },
        placeholderData: keepPreviousData,
    })

    const table = useDataTable({
        mode: 'server',
        data: query.data?.rows ?? noRows,
        rowCount: query.data?.total,
        columns,
        getRowId: (facility) => facility.id,
        state: { sorting, columnFilters, globalFilter, pagination },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
    })

    return (
        <div className="flex flex-col gap-3">
            <Label>
                <Checkbox
                    checked={failNext}
                    onCheckedChange={(checked) => setFailNext(checked)}
                />
                Fail the next request
            </Label>
            <DataTable
                table={table}
                label="Facilities"
                status={statusOf(query)}
                onRetry={() => query.refetch()}
            >
                <DataTableToolbar>
                    <DataTableSearch placeholder="Search facilities" />
                    <DataTableFilters filters={filters} />
                </DataTableToolbar>
                <DataTableContent />
                <DataTablePagination />
            </DataTable>
        </div>
    )
}

/** One page at a time from a pretend server, through TanStack Query. */
const DataTableServer = () => {
    const [queryClient] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
    )
    return (
        <QueryClientProvider client={queryClient}>
            <ServerFacilities />
        </QueryClientProvider>
    )
}

export default DataTableServer
