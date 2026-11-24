import { createElement, type ReactNode } from 'react'
import type {
    VisitDateProps,
    VisitFactState,
    VisitFactValueProps,
    VisitItemProps,
    VisitServiceProps,
    VisitStatusProps,
    VisitStatusVariant,
    VisitViewerProps,
    VisitViewerSettings,
} from '../index'
import {
    useVisitViewer,
    VisitDate,
    VisitFactValue,
    VisitItem,
    VisitService,
    VisitStatus,
    VisitViewer,
    visitStatusVariants,
} from '../index'

export type SupportedVisitViewerTypes = [
    VisitDateProps,
    VisitFactState,
    VisitFactValueProps,
    VisitItemProps,
    VisitServiceProps,
    VisitStatusProps,
    VisitStatusVariant,
    VisitViewerProps,
    VisitViewerSettings,
]

export const statuses: VisitStatusVariant[] = [
    'completed',
    'in-progress',
    'scheduled',
    'overdue',
    'skipped',
]
// @ts-expect-error A status is one of the five visit statuses, not an event status.
export const active: VisitStatusVariant = 'active'

export const states: VisitFactState[] = [
    'value',
    'missing',
    'not-performed',
    'restricted',
]

export const viewer: VisitViewerProps = {
    calendar: 'ethiopian',
    locale: 'am',
    'aria-label': 'Visits',
}
// @ts-expect-error The calendar is a DHIS2 calendar name.
export const unknownCalendar: VisitViewerProps = { calendar: 'julian' }

export const date: VisitDateProps = {
    value: '2026-11-12T14:30:00.000',
    showTime: true,
    prefix: 'Due',
}
// @ts-expect-error A date is the stored string, never a Date.
export const dateObject: VisitDateProps = { value: new Date(0) }

export const item: VisitItemProps = {
    status: 'skipped',
    defaultOpen: true,
    onOpenChange: (open: boolean) => open,
}

// @ts-expect-error Visits are mapped in JSX: there is no visits array prop.
export const noVisits: VisitViewerProps = { visits: [] }

// @ts-expect-error Slots are children: there are no component props.
export const noActions: VisitItemProps = { actions: 'Open' }

export const page: () => ReactNode = () =>
    createElement(
        VisitViewer,
        { calendar: 'gregorian' },
        createElement(
            VisitItem,
            { status: 'completed' },
            createElement(VisitDate, { value: '2026-11-12' }),
            createElement(VisitStatus, { variant: 'completed' }),
            createElement(VisitService, { status: 'overdue' }, 'Vaccination'),
            createElement(VisitFactValue, { state: 'not-performed' })
        )
    )

export const badgeClass: string = visitStatusVariants({ variant: 'overdue' })

export const useCalendarName: () => string = () => {
    const { calendar } = useVisitViewer()
    return calendar
}
