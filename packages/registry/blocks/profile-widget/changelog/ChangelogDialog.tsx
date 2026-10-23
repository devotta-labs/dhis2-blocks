import i18n from '@dhis2/d2-i18n'
import { IconChevronLeft16, IconChevronRight16 } from '@dhis2/ui-icons'
import React, { useMemo, useState } from 'react'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dhis2/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { useProfileServerFeatures } from '../api/runtime'
import type {
    ControlledDialogProps,
    TrackedEntityAttributeField,
    TrackedEntityChangelogOrder,
} from '../types'
import { ChangelogTable } from './ChangelogTable'
import { selectChangelogFilterAttributes } from './normalize'
import { useTrackedEntityChangelog } from './useTrackedEntityChangelog'

export type ProfileWidgetChangelogDialogProps = ControlledDialogProps & {
    trackedEntityId: string
    programId?: string
    /** Labels the rows and fills the data-item filter: pass data.attributes */
    attributes: readonly TrackedEntityAttributeField[]
}

/** Capture's page size; the pager has no total, so paging is prev / next. */
const CHANGELOG_PAGE_SIZE = 10

function DataItemFilter({
    attributes,
    value,
    onValueChange,
}: {
    attributes: readonly TrackedEntityAttributeField[]
    value: string | null
    onValueChange: (attributeId: string | null) => void
}) {
    const label = i18n.t('Data item')
    const items = useMemo(
        () => [
            { value: null, label: i18n.t('Show all') },
            ...attributes.map((attribute) => ({
                value: attribute.id,
                label: attribute.label,
            })),
        ],
        [attributes]
    )

    return (
        <Select
            items={items}
            value={value}
            onValueChange={(next) => onValueChange(next)}
        >
            <SelectTrigger
                size="sm"
                aria-label={label}
                className="w-auto max-w-full gap-0"
                data-test="profile-widget-changelog-filter"
            >
                <span aria-hidden="true" className="pe-2 text-dhis2-grey-600">
                    {label}
                </span>
                <SelectValue className="flex-none" />
            </SelectTrigger>
            <SelectContent className="w-auto">
                {items.map((item) => (
                    <React.Fragment key={item.value ?? ''}>
                        <SelectItem value={item.value}>{item.label}</SelectItem>
                        {/* Capture's divider under "Show all" */}
                        {item.value === null && items.length > 1 && (
                            <SelectSeparator />
                        )}
                    </React.Fragment>
                ))}
            </SelectContent>
        </Select>
    )
}

function ChangelogPagination({
    page,
    hasNextPage,
    disabled,
    isFetching,
    onPageChange,
}: {
    page: number
    hasNextPage: boolean
    disabled: boolean
    isFetching: boolean
    onPageChange: (page: number) => void
}) {
    return (
        <div
            data-test="profile-widget-changelog-pagination"
            className="mt-2 flex min-h-(--dhis2-field-height-dense) items-center justify-end gap-1"
        >
            {isFetching && (
                <Spinner
                    className="me-2"
                    aria-label={i18n.t('Loading changelog')}
                />
            )}
            <Button
                variant="secondary"
                size="field-dense"
                className="ps-0"
                data-test="profile-widget-changelog-previous-page"
                disabled={disabled || page <= 1}
                onClick={() => onPageChange(page - 1)}
            >
                <span className="flex rtl:rotate-180">
                    <IconChevronLeft16 />
                </span>
                {i18n.t('Previous page')}
            </Button>
            <Button
                variant="secondary"
                size="field-dense"
                className="pe-0"
                data-test="profile-widget-changelog-next-page"
                disabled={disabled || !hasNextPage}
                onClick={() => onPageChange(page + 1)}
            >
                {i18n.t('Next page')}
                <span className="flex rtl:rotate-180">
                    <IconChevronRight16 />
                </span>
            </Button>
        </div>
    )
}

/**
 * The dialog body. It mounts only while the dialog is open, so nothing is
 * fetched for a closed dialog and paging, filter and order reset on reopen.
 */
function ChangelogDialogBody({
    trackedEntityId,
    programId,
    attributes,
}: Omit<ProfileWidgetChangelogDialogProps, keyof ControlledDialogProps>) {
    const features = useProfileServerFeatures()
    const [page, setPage] = useState(1)
    const [attributeId, setAttributeId] = useState<string | null>(null)
    const [order, setOrder] = useState<TrackedEntityChangelogOrder | null>(null)
    const filterAttributes = useMemo(
        () => selectChangelogFilterAttributes(attributes, programId ?? null),
        [attributes, programId]
    )
    const showFilter =
        features.changelogFilterAndOrder && filterAttributes.length > 0

    const { data, error, isFetching, refetch } = useTrackedEntityChangelog({
        trackedEntityId,
        programId,
        attributes,
        page,
        pageSize: CHANGELOG_PAGE_SIZE,
        attributeId: attributeId ?? undefined,
        order: order ?? undefined,
    })

    return (
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            {showFilter && (
                <div className="mb-2 flex">
                    <DataItemFilter
                        attributes={filterAttributes}
                        value={attributeId}
                        onValueChange={(next) => {
                            setAttributeId(next)
                            setPage(1)
                        }}
                    />
                </div>
            )}
            {error ? (
                <ErrorAlert
                    data-test="profile-widget-changelog-error"
                    title={i18n.t('The changelog could not be loaded')}
                >
                    <Button
                        variant="secondary"
                        size="field-dense"
                        className="mt-2"
                        data-test="profile-widget-changelog-retry"
                        disabled={isFetching}
                        onClick={refetch}
                    >
                        {i18n.t('Try again')}
                    </Button>
                </ErrorAlert>
            ) : (
                <ChangelogTable
                    entries={data?.entries}
                    isFetching={isFetching}
                    order={order}
                    canSortByUserAndDataItem={features.changelogFilterAndOrder}
                    onOrderChange={(next) => {
                        setOrder(next)
                        setPage(1)
                    }}
                />
            )}
            {/* Stays after a failed page, so earlier (cached) pages remain reachable. */}
            <ChangelogPagination
                page={page}
                hasNextPage={error ? false : (data?.hasNextPage ?? false)}
                disabled={isFetching || (!error && data === undefined)}
                isFetching={data !== undefined && isFetching}
                onPageChange={setPage}
            />
        </div>
    )
}

/** Large dialog, page size 10, prev/next paging; filter and sort on 2.42+. */
export function ProfileWidgetChangelogDialog({
    open,
    onOpenChange,
    ...bodyProps
}: ProfileWidgetChangelogDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
            <DialogContent
                size="lg"
                closeLabel={i18n.t('Close')}
                data-test="profile-widget-changelog-dialog"
            >
                <DialogHeader>
                    <DialogTitle>{i18n.t('Changelog')}</DialogTitle>
                </DialogHeader>
                <ChangelogDialogBody {...bodyProps} />
                <DialogFooter>
                    <DialogClose render={<Button variant="secondary" />}>
                        {i18n.t('Close')}
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
