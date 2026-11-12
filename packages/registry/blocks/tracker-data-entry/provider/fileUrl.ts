import type { CellKey } from '@/components/spreadsheet'
import { fieldIdOfKey, recordIdOf } from '../model/types'
import type { DataRecord } from '../model/types'

/** Where DHIS2 serves the file an event holds for a data element; an image can be shown from it. */
export const eventFileUrl = (
    baseUrl: string,
    eventId: string,
    dataElementId: string,
    image: boolean
): string =>
    `${baseUrl}/api/tracker/events/${eventId}/dataValues/${dataElementId}/${image ? 'image' : 'file'}`

/**
 * The spreadsheet's `fileUrl`: an event's cell is served from the event's data value. A person's or enrolment's cell
 * has no address, so it shows the file's name only. `records` is read when asked, as a record's kind never changes.
 */
export const fileUrlOf =
    (baseUrl: string, records: () => ReadonlyMap<string, DataRecord>) =>
    (key: CellKey, image: boolean): string | undefined => {
        const record = records().get(recordIdOf(key))
        return record?.kind === 'event'
            ? eventFileUrl(baseUrl, record.id, fieldIdOfKey(key), image)
            : undefined
    }
