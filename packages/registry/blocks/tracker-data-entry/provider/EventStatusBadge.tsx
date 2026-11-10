import { translatedText } from '../../spreadsheet/cells/translatedText'
import { useTrackerContext } from './hooks'

/** "Completed" beside a completed event's label, "Scheduled" beside a scheduled or overdue one's; nothing otherwise. */
export const EventStatusBadge = ({ rowId }: { rowId: string }) => {
    const { records } = useTrackerContext()
    const record = records.get(rowId)
    const status = record?.kind === 'event' ? record.status : undefined
    const scheduled =
        status === 'SCHEDULE' || status === 'OVERDUE'
            ? translatedText('Scheduled')
            : undefined
    const marker =
        status === 'COMPLETED' ? translatedText('Completed') : scheduled
    return marker === undefined ? null : (
        <>
            {' '}
            <span className="inline-block rounded-full bg-dhis2-neutral-fill px-1.5 text-xs text-dhis2-neutral-strong">
                {marker}
            </span>
        </>
    )
}
