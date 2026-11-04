import { useConfig } from '@dhis2/app-runtime'
import {
    parseDhis2Calendar,
    type Dhis2Calendar,
} from '@/components/dhis2-value-display/calendar'
import { z } from 'zod'

// app-runtime's SystemInfo type leaves out `calendar`, which the server sends.
const SystemInfoCalendarSchema = z.object({ calendar: z.string().optional() })

/** The system calendar from `systemInfo.calendar`; anything unknown is Gregorian. */
export const useSystemCalendar = (): Dhis2Calendar => {
    const { systemInfo } = useConfig()
    return parseDhis2Calendar(
        SystemInfoCalendarSchema.safeParse(systemInfo).data?.calendar
    )
}
