import {
    calendarDateToIso,
    isoToCalendarDate,
} from '@/components/tracked-entity-finder/calendar/calendarDates'
import { formatCalendarDate } from '@/components/dhis2-value-display/calendar'
import { resolveWorkingListCapabilities } from '../api/capabilities'
import type { WorkingListCalendar } from '../api/systemInfo'
import type {
    AppliedFilter,
    FilterValue,
    RelativeDatePeriod,
    WorkingListConfiguration,
} from '../domain/model'
import {
    getSystemFilterDefinition,
    systemColumnFields,
} from '../registry/systemFilters'
import { createWorkingListValueTransformers } from '../registry/transformers'
import { getValueTypeDefinition } from '../registry/valueTypes'
import type { FilterSerializationContext } from '../registry/valueTypeContracts'
import { serializeWorkingListRequest } from './serialize'

const definition = getSystemFilterDefinition('eventScheduledAt')!
const fields = new Map(
    [...systemColumnFields, definition.field].map((field) => [field.id, field])
)
const filterFor = (value: FilterValue): AppliedFilter => ({
    field: definition.field,
    operator: 'range',
    value,
})
const request = (
    value: FilterValue,
    serializationContext?: FilterSerializationContext,
    range?: { fieldId: string; start: string; end: string }
) => {
    const configuration: WorkingListConfiguration = {
        mode: 'event',
        programId: 'Program0001',
        programStageId: 'ProgramStg1',
        columns: ['eventScheduledAt'],
        sort: { fieldId: 'createdAt', direction: 'desc' },
        filters: [filterFor(value)],
    }
    const before = structuredClone(configuration)
    const result = serializeWorkingListRequest({
        context: { programId: 'Program0001', orgUnitId: 'OrgUnit0001' },
        configuration,
        pagination: { page: 2, pageSize: 25 },
        capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
        fields,
        serializationContext,
        range,
    })
    expect(configuration).toEqual(before)
    expect(result.params?.page).toBe(2)
    return result.params
}
const transformersFor = (
    calendar: WorkingListCalendar,
    today = '2024-09-10',
    firstDayOfWeek?: 0 | 1
) =>
    createWorkingListValueTransformers({
        systemInfo: {
            calendar,
            dateFormat: 'YYYY-MM-DD',
            serverTimeZoneId: 'Pacific/Kiritimati',
        },
        today,
        firstDayOfWeek,
    })

describe('calendar-to-request boundary', () => {
    it.each(['ethiopian', 'coptic'] as const)(
        'keeps %s relative resolver bounds in API order without a second conversion',
        (calendar) => {
            const transformers = transformersFor(calendar)
            const periods: [RelativeDatePeriod, string, string][] = [
                ['TODAY', '2024-09-10', '2024-09-10'],
                ['THIS_WEEK', '2024-09-08', '2024-09-14'],
                ['LAST_WEEK', '2024-09-01', '2024-09-07'],
                ['THIS_MONTH', '2024-09-06', '2024-09-10'],
                ['LAST_MONTH', '2024-08-07', '2024-09-05'],
                ['LAST_3_MONTHS', '2024-06-08', '2024-09-05'],
                ['THIS_YEAR', '2023-09-12', '2024-09-10'],
            ]
            for (const [period, start, end] of periods) {
                const value = {
                    kind: 'dateRange',
                    mode: 'relative',
                    period,
                } as const
                expect(
                    request(value, transformers.serializationContext)
                ).toMatchObject({ scheduledAfter: start, scheduledBefore: end })
                expect(
                    getValueTypeDefinition('DATE').serializeSaved(
                        filterFor(value),
                        transformers.serializationContext
                    )
                ).toEqual({ dateFilter: { type: 'RELATIVE', period } })
            }
            expect(
                request(
                    {
                        kind: 'dateRange',
                        mode: 'relative',
                        startBuffer: -2,
                        endBuffer: 3,
                    },
                    transformers.serializationContext
                )
            ).toMatchObject({
                scheduledAfter: '2024-09-08',
                scheduledBefore: '2024-09-13',
            })
            expect(
                request(
                    {
                        kind: 'dateRange',
                        mode: 'relative',
                        period: 'THIS_WEEK',
                    },
                    transformersFor(calendar, '2024-09-10', 1)
                        .serializationContext
                )
            ).toMatchObject({
                scheduledAfter: '2024-09-09',
                scheduledBefore: '2024-09-15',
            })
            expect(
                request(
                    {
                        kind: 'dateRange',
                        mode: 'relative',
                        period: 'THIS_MONTH',
                    },
                    transformersFor(calendar, '2023-09-11').serializationContext
                )
            ).toMatchObject({
                scheduledAfter: '2023-09-06',
                scheduledBefore: '2023-09-11',
            })
        }
    )

    it.each([
        ['ethiopian', '2016-13-01', '2016-13-05'],
        ['coptic', '1740-13-01', '1740-13-05'],
    ] as const)(
        'converts explicit %s dates once before inclusive window intersection',
        (calendar, start, end) => {
            const context = transformersFor(calendar).serializationContext
            const range = {
                fieldId: 'eventScheduledAt',
                start: '2024-09-08',
                end: '2024-09-12',
            }
            expect(
                request(
                    { kind: 'dateRange', mode: 'absolute', start, end },
                    context,
                    range
                )
            ).toMatchObject({
                scheduledAfter: '2024-09-08',
                scheduledBefore: '2024-09-10',
            })
            expect(
                request(
                    {
                        kind: 'dateRange',
                        mode: 'relative',
                        period: 'THIS_MONTH',
                    },
                    context,
                    range
                )
            ).toMatchObject({
                scheduledAfter: '2024-09-08',
                scheduledBefore: '2024-09-10',
            })
        }
    )

    it('uses the server-zone day and retains the no-context Gregorian fallback', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-09-10T10:30:00Z'))
        try {
            const transformers = createWorkingListValueTransformers({
                systemInfo: {
                    calendar: 'ethiopian',
                    dateFormat: 'YYYY-MM-DD',
                    serverTimeZoneId: 'Pacific/Kiritimati',
                },
            })
            expect(
                request(
                    { kind: 'dateRange', mode: 'relative', period: 'TODAY' },
                    transformers.serializationContext
                )
            ).toMatchObject({
                scheduledAfter: '2024-09-11',
                scheduledBefore: '2024-09-11',
            })
            expect(
                request({
                    kind: 'dateRange',
                    mode: 'relative',
                    period: 'TODAY',
                })
            ).toMatchObject({
                scheduledAfter: '2024-09-10',
                scheduledBefore: '2024-09-10',
            })
        } finally {
            vi.useRealTimers()
        }
    })

    it.each([
        ['gregorian', '2024-02-29', '2024-02-29'],
        ['ethiopian', '2015-13-06', '2023-09-11'],
        ['ethiopian', '2016-13-05', '2024-09-10'],
        ['coptic', '1739-13-06', '2023-09-11'],
        ['coptic', '1740-13-05', '2024-09-10'],
    ] as const)(
        'agrees across strict %s consumers in both editor orders',
        (calendar, local, iso) => {
            const transformers = transformersFor(calendar)
            expect(transformers.clientToServer(local, 'DATE')).toBe(iso)
            expect(transformers.serverToClient(iso, 'DATE')).toBe(local)
            for (const dateFormat of ['YYYY-MM-DD', 'DD-MM-YYYY'] as const) {
                const input =
                    dateFormat === 'YYYY-MM-DD'
                        ? local
                        : local.split('-').reverse().join('-')
                expect(calendarDateToIso(input, { calendar, dateFormat })).toBe(
                    iso
                )
                expect(isoToCalendarDate(iso, { calendar, dateFormat })).toBe(
                    input
                )
            }
            expect(
                transformers.serverToClient(`${iso}T23:30:00-11:00`, 'DATETIME')
            ).toBe(`${local} 23:30:00`)
        }
    )

    it('retains Coptic raw-day display fallback while strict editors reject invalid local days', () => {
        expect(formatCalendarDate('2024-09-10', 'coptic')).toBe('2024-09-10')
        expect(
            calendarDateToIso('1740-13-06', {
                calendar: 'coptic',
                dateFormat: 'YYYY-MM-DD',
            })
        ).toBeUndefined()
        expect(() =>
            transformersFor('coptic').clientToServer('1740-13-06', 'DATE')
        ).toThrow('Invalid coptic calendar date')
    })
})
