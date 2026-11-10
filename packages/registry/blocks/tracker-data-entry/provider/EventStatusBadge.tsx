import i18n from '@dhis2/d2-i18n'
import { useTrackerContext } from './hooks'

/** "Completed" beside a completed event's label, "Scheduled" beside a scheduled or overdue one's; nothing otherwise. */
export const EventStatusBadge = ({ rowId }: { rowId: string }) => {
    const { records } = useTrackerContext()
    const record = records.get(rowId)
    const status = record?.kind === 'event' ? record.status : undefined
    const scheduled =
        status === 'SCHEDULE' || status === 'OVERDUE'
            ? i18n.t('Scheduled')
            : undefined
    const marker = status === 'COMPLETED' ? i18n.t('Completed') : scheduled
    return marker === undefined ? null : (
        <>
            {' '}
            <span className="inline-block rounded-full bg-dhis2-grey-200 px-1.5 text-xs text-dhis2-grey-800">
                {marker}
            </span>
        </>
    )
}
