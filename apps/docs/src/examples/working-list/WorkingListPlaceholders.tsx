import {
    Button,
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableHead,
    DataTableRow,
    DropdownButton,
    FlyoutMenu,
    IconFilter16,
    IconLayoutColumns16,
    IconMore16,
    Pagination,
} from '@dhis2/ui'

/**
 * Loading placeholders for the Working List examples.
 *
 * These belong to the docs, not the block: they cover the time before the
 * example can mount the block at all — its code loading and the adapter
 * starting the DHIS2 session. They copy the shape of the block's own loading
 * state (10 rows, matching the examples' `defaultPagination`) so the preview
 * does not change layout when the block takes over. If the block's layout
 * changes, update these to match.
 */
const PAGE_SIZE = 10

const COLUMN_COUNT = 4

const cellWidths = ['w-[46%]', 'w-[62%]', 'w-[34%]', 'w-[54%]', 'w-[40%]']

const viewPillWidths = ['w-[132px]', 'w-[160px]', 'w-[152px]']

const noop = () => {}

const Bar = ({ className }: { className: string }) => (
    <span
        className={`inline-block max-w-full animate-pulse bg-[#e8edf2] align-middle motion-reduce:animate-none ${className}`}
    />
)

const ToolbarControls = () => (
    <>
        <div className="flex flex-none items-center">
            <Button secondary small icon={<IconLayoutColumns16 />} disabled>
                Columns
            </Button>
        </div>
        <div className="flex min-w-0 flex-[1_1_0%] flex-wrap items-center gap-1">
            <Button secondary small icon={<IconFilter16 />} disabled>
                Filter
            </Button>
        </div>
        <div className="ml-auto flex flex-none items-center gap-1">
            <Button secondary small disabled>
                Save view
            </Button>
            <DropdownButton
                secondary
                small
                icon={<IconMore16 />}
                disabled
                component={<FlyoutMenu dense />}
            >
                More
            </DropdownButton>
        </div>
    </>
)

const WorkingListPlaceholder = ({
    toolbarControls,
}: {
    toolbarControls: boolean
}) => (
    <div className="w-full min-w-0" aria-busy="true">
        <span className="sr-only" role="status">
            Loading the working list…
        </span>
        <div
            className="w-full min-w-0 max-w-full rounded-[4px] border border-[#d5dde5] bg-white shadow-[0_1px_2px_rgb(33_41_52_/_8%)]"
            aria-hidden="true"
        >
            <p className="m-0 p-2 text-xs leading-4 text-[var(--colors-grey700)]">
                Saved views in this program
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-1 border-b border-[#e8edf2] px-2 pt-0 pb-2">
                {viewPillWidths.map((width) => (
                    <Bar
                        key={width}
                        className={`h-[30px] rounded-2xl ${width}`}
                    />
                ))}
            </div>
            <div className="flex min-w-0 max-w-full items-center gap-1 border-b border-[#e8edf2] px-2 py-3 [@media(max-width:560px)]:flex-col [@media(max-width:560px)]:items-stretch">
                {toolbarControls && <ToolbarControls />}
            </div>
            <div className="w-full min-w-0 max-w-full overflow-x-scroll [contain:layout] [overscroll-behavior-inline:contain]">
                <div className="min-w-[680px]">
                    <DataTable>
                        <DataTableHead>
                            <DataTableRow>
                                {Array.from(
                                    { length: COLUMN_COUNT },
                                    (_, column) => (
                                        <DataTableCell key={column} tag="th">
                                            <Bar
                                                className={`h-3 rounded-[3px] ${column % 2 === 0 ? 'w-24' : 'w-20'}`}
                                            />
                                        </DataTableCell>
                                    )
                                )}
                            </DataTableRow>
                        </DataTableHead>
                        <DataTableBody>
                            {Array.from({ length: PAGE_SIZE }, (_, row) => (
                                <DataTableRow key={row}>
                                    {Array.from(
                                        { length: COLUMN_COUNT },
                                        (_, column) => (
                                            <DataTableCell
                                                key={column}
                                                className="min-w-[140px]"
                                            >
                                                <Bar
                                                    className={`h-3.5 rounded-[3px] ${cellWidths[(row * 3 + column) % cellWidths.length]}`}
                                                />
                                            </DataTableCell>
                                        )
                                    )}
                                </DataTableRow>
                            ))}
                        </DataTableBody>
                    </DataTable>
                </div>
            </div>
            <div className="flex min-h-14 w-full min-w-0 max-w-full items-center justify-end px-3 py-2 [&_[data-test='dhis2-uicore-select-input']_>_:last-child]:[margin-block-start:0]">
                <Pagination
                    page={1}
                    pageSize={PAGE_SIZE}
                    pageLength={0}
                    pageSizes={['10', '15', '25', '50', '100']}
                    isLastPage
                    hidePageSelect
                    hidePageSummary
                    disabled
                    onPageChange={noop}
                    onPageSizeChange={noop}
                />
            </div>
        </div>
    </div>
)

export const WorkingListDefaultPlaceholder = () => (
    <WorkingListPlaceholder toolbarControls />
)

export const WorkingListProgramPickerPlaceholder = () => (
    <>
        <div className="mb-4 w-full max-w-sm">
            <Bar className="block h-10 w-[218px] rounded-[3px]" />
        </div>
        <WorkingListPlaceholder toolbarControls={false} />
    </>
)
