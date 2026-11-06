import i18n from '@dhis2/d2-i18n'
import type { FinderSystemInfo } from '../api/systemInfo'
import { isoToCalendarDate } from '../calendar/calendarDates'
import type { FinderAttribute } from '../rules/types'

const EMPTY = '—'
const ISO_DATE_START = /^\d{4}-\d{2}-\d{2}/
const TIME = /[T ](\d{2}:\d{2})/

const formatDate = (raw: string, info: FinderSystemInfo) =>
    ISO_DATE_START.test(raw) ? isoToCalendarDate(raw.slice(0, 10), info) : raw

const formatDateTime = (raw: string, info: FinderSystemInfo) => {
    if (!ISO_DATE_START.test(raw)) {
        return raw
    }
    const date = isoToCalendarDate(raw.slice(0, 10), info)
    const time = TIME.exec(raw)?.[1]
    return time ? `${date} ${time}` : date
}

export const formatValue = (
    attribute: Pick<FinderAttribute, 'valueType' | 'options'> | undefined,
    raw: string,
    info: FinderSystemInfo
): string => {
    if (raw.trim() === '') {
        return EMPTY
    }
    if (attribute?.options) {
        if (attribute.valueType === 'MULTI_TEXT') {
            // Stored as comma-separated codes.
            return raw
                .split(',')
                .map(
                    (code) =>
                        attribute.options?.find(
                            (option) => option.code === code
                        )?.name ?? code
                )
                .join(', ')
        }
        return attribute.options.find(({ code }) => code === raw)?.name ?? raw
    }
    switch (attribute?.valueType) {
        case 'DATE':
        case 'AGE':
            return formatDate(raw, info)
        case 'DATETIME':
            return formatDateTime(raw, info)
        case 'BOOLEAN':
            if (raw === 'false') {
                return i18n.t('No')
            }
            return raw === 'true' ? i18n.t('Yes') : raw
        case 'TRUE_ONLY':
            return raw === 'true' ? i18n.t('Yes') : raw
        default:
            return raw
    }
}
