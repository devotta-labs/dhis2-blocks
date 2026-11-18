import { Badge } from '@/components/dhis2/ui/badge'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import {
    PatientList,
    attributeColumn,
    attributeTextFilter,
    enrollmentDateFilter,
    enrollmentStatusFilter,
    fieldColumn,
    usePatientList,
} from '@/components/patient-list'

const STATUSES = {
    ACTIVE: ['Active', 'bg-dhis2-info-fill text-dhis2-info-strong'],
    COMPLETED: ['Completed', 'bg-dhis2-success-fill text-dhis2-success-strong'],
    CANCELLED: ['Cancelled', 'bg-dhis2-accent text-dhis2-accent-foreground'],
} as const

// Defined once, outside the component, so the list keeps them between renders.
const columns = [
    attributeColumn('w75KJ2mc4zz', { header: 'First name' }),
    attributeColumn('zDhUuAYrxNC', { header: 'Last name' }),
    attributeColumn('cejWyOfXge6', { header: 'Gender' }),
    fieldColumn('enrolledAt', {
        header: 'Enrolled',
        nowrap: true,
        format: (value) =>
            formatDhis2Value(
                value,
                { valueType: 'DATE' },
                { calendar: 'iso8601' }
            ),
    }),
    fieldColumn('enrollmentStatus', {
        header: 'Status',
        format: (_value, row) => {
            const status = row.enrollment?.status
            if (status === undefined) return null
            const [label, tone] = STATUSES[status]
            return <Badge className={tone}>{label}</Badge>
        },
    }),
]

const filters = [
    attributeTextFilter({
        attribute: 'w75KJ2mc4zz',
        label: 'First name',
        pinned: true,
    }),
    attributeTextFilter({ attribute: 'zDhUuAYrxNC', label: 'Last name' }),
    enrollmentStatusFilter({ pinned: true }),
    enrollmentDateFilter({ field: 'enrolledAt', label: 'Enrolled' }),
]

/**
 * The people enrolled in a program at one organisation unit, with the
 * columns and filters this app chose.
 *
 * `IpHINAT79UW` (Child Programme), `DiszpKrYNg8` (Ngelehun CHC) and the
 * attributes `w75KJ2mc4zz` (First name), `zDhUuAYrxNC` (Last name) and
 * `cejWyOfXge6` (Gender) exist in the DHIS2 Sierra Leone demo database.
 * Replace them with ids from your own instance.
 */
const PatientListDefault = () => {
    const list = usePatientList({
        program: 'IpHINAT79UW',
        orgUnit: 'DiszpKrYNg8',
        columns,
        filters,
        initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    })
    return <PatientList list={list} />
}

export default PatientListDefault
