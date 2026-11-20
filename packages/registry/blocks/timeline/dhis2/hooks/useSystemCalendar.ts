import { useConfig } from '@dhis2/app-runtime'
import { parseDhis2Calendar } from '@/components/dhis2-value-display/calendar'
import { z } from 'zod'

const SystemInfoCalendarSchema = z.object({ calendar: z.string().optional() })

/** The system calendar from `systemInfo.calendar`; anything unknown is Gregorian. */
export const useSystemCalendar = () => {
    const { systemInfo } = useConfig()
    return parseDhis2Calendar(
        SystemInfoCalendarSchema.safeParse(systemInfo).data?.calendar
    )
}
