import { useConfig } from '@dhis2/app-runtime'
import {
    parseDhis2Calendar,
    type Dhis2Calendar,
} from '@/registry/dhis2/value-display/calendar'
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

/**
 * The server's minor version (42 for 2.42). Unknown reads as 0, so
 * version-gated features stay off rather than fail.
 */
export const useServerMinor = (): number => {
    const { serverVersion } = useConfig()
    return serverVersion?.minor ?? 0
}
