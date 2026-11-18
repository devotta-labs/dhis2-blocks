import type { DataTableState } from '@/components/data-table'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    PatientList,
    usePatientList,
    type UsePatientListOptions,
} from '@/components/patient-list'
import { useQuery } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'
import i18n from '../../i18n'
import type { AppClient } from '../AppShell/appClient'
import {
    buildInitialColumnVisibility,
    buildPatientListColumns,
    buildPatientListFilters,
} from './patientListModel'
import {
    programListAttributesQueryOptions,
    type ProgramListAttribute,
} from './programListMetadata'

type PaginationState = DataTableState['pagination']
type PaginationUpdater = Parameters<
    NonNullable<UsePatientListOptions['onPaginationChange']>
>[0]

interface PatientListViewProps {
    client: AppClient
    programId: string
    orgUnitId: string
    /** From 1. */
    page: number
    pageSize: number
    onPaginationChange: (next: { page: number; pageSize: number }) => void
    onRowOpen: (trackedEntityId: string) => void
}

interface PatientListTableProps extends Omit<PatientListViewProps, 'client'> {
    attributes: readonly ProgramListAttribute[]
}

const PatientListTable = ({
    programId,
    orgUnitId,
    page,
    pageSize,
    onPaginationChange,
    onRowOpen,
    attributes,
}: PatientListTableProps) => {
    const columns = useMemo(
        () => buildPatientListColumns(attributes),
        [attributes]
    )
    const columnVisibility = useMemo(
        () => buildInitialColumnVisibility(attributes),
        [attributes]
    )
    const filters = useMemo(
        () => buildPatientListFilters(attributes),
        [attributes]
    )

    // The page lives in React state and is mirrored to the URL. The router
    // writes the URL in a transition, so a sort or filter change (which
    // returns to the first page) would otherwise render once with the new
    // query and the old page.
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: page - 1,
        pageSize,
    })
    // Adopt the URL when it changes from outside (back/forward, edited link).
    const [seenUrl, setSeenUrl] = useState({ page, pageSize })
    if (seenUrl.page !== page || seenUrl.pageSize !== pageSize) {
        setSeenUrl({ page, pageSize })
        setPagination({ pageIndex: page - 1, pageSize })
    }
    const handlePaginationChange = (updater: PaginationUpdater) => {
        const next = updater instanceof Function ? updater(pagination) : updater
        setPagination(next)
        onPaginationChange({
            page: next.pageIndex + 1,
            pageSize: next.pageSize,
        })
    }

    const list = usePatientList({
        program: programId,
        orgUnit: orgUnitId,
        columns,
        filters,
        initialState: { columnVisibility },
        state: { pagination },
        onPaginationChange: handlePaginationChange,
    })

    return (
        <PatientList
            list={list}
            label={i18n.t('Patient list')}
            onRowOpen={(row) => onRowOpen(row.trackedEntity)}
        />
    )
}

/** The tracked entities of a program in an organisation unit. */
export const PatientListView = ({ client, ...props }: PatientListViewProps) => {
    const attributesQuery = useQuery(
        programListAttributesQueryOptions(client, props.programId)
    )

    if (attributesQuery.isPending) {
        return (
            <div
                className="flex min-h-[220px] items-center justify-center"
                data-testid="patient-list-loading"
            >
                <Spinner
                    label={i18n.t('Loading')}
                    className="size-6 border-4"
                />
            </div>
        )
    }

    if (attributesQuery.isError) {
        return (
            <div
                className="flex min-h-[220px] items-center justify-center"
                data-testid="patient-list-error"
            >
                <ErrorAlert
                    title={i18n.t('The list columns could not be loaded')}
                >
                    <p>{attributesQuery.error.message}</p>
                    <Button
                        variant="outline"
                        onClick={() => void attributesQuery.refetch()}
                    >
                        {i18n.t('Try again')}
                    </Button>
                </ErrorAlert>
            </div>
        )
    }

    return (
        <PatientListTable
            key={`${props.programId}:${props.orgUnitId}`}
            {...props}
            attributes={attributesQuery.data}
        />
    )
}
