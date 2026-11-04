# DHIS2 Value Display

Read-only formatting of DHIS2 values and calendar dates. Pure functions with no React: option sets show option names, other values are formatted by value type, and dates are shown in the system calendar on the day they were stored. The timeline block uses it for every value and date it shows.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/dhis2-value-display
```

## Format a value

`formatDhis2Value(value, meta, options)` takes the stored string, what you know about its type (`valueType`, and `optionSet` for option names) and the calendar and locale to read it in. Data element and attribute metadata fit `meta` directly.

```ts
import {
    formatDhis2Value,
    parseDhis2Calendar,
} from '@/components/dhis2-value-display'

const calendar = parseDhis2Calendar('ethiopian') // from systemInfo.calendar

formatDhis2Value(
    '2026-10-14T23:30:00.000',
    { valueType: 'DATETIME' },
    { calendar, locale: 'en' }
)

formatDhis2Value(
    'F',
    {
        valueType: 'TEXT',
        optionSet: { options: [{ code: 'F', displayName: 'Female' }] },
    },
    { calendar, locale: 'en' }
)
// "Female"
```

## Show a stored date

`storedDay` and `storedTime` read the day and time as the server wrote them, so a late-evening date-time never moves to the next day. `formatCalendarDate` shows that day in the system calendar.

```tsx
import {
    formatCalendarDate,
    parseDhis2Calendar,
    storedDay,
    storedTime,
} from '@/components/dhis2-value-display'

export const StoredAt = ({
    storedAt, // placeholder: a stored date-time such as "2026-10-14T23:30:00.000"
    systemCalendar,
}: {
    storedAt: string
    systemCalendar?: string
}) => {
    const day = storedDay(storedAt)
    if (day === undefined) {
        return null
    }
    const calendar = parseDhis2Calendar(systemCalendar)
    return (
        <time dateTime={storedAt}>
            {formatCalendarDate(day, calendar, 'en')} {storedTime(storedAt)}
        </time>
    )
}
```

## API

```ts
formatDhis2Value(value, meta, options): string // a stored value as shown for reading
formatCalendarDate(isoDay, calendar, locale?): string // a stored day in the system calendar
storedDay(value): string | undefined // the YYYY-MM-DD prefix as stored
storedTime(value): string | undefined // the HH:mm of a stored date-time
parseDhis2Calendar(value): Dhis2Calendar // systemInfo.calendar; unknown is gregorian
```

## Boundaries

- The day is read from the stored text, never through the viewer's time zone, and converted into the calendar you pass.
- Gregorian and ISO 8601 dates read as "Oct 14, 2026" in the locale. Every other calendar (Ethiopian, Coptic, Nepali, Islamic, Persian, Thai) reads as `YYYY-MM-DD` in that calendar, with no month names: Ethiopian `2019-02-04` is 14 October 2026. Dates are converted by `@dhis2/multi-calendar-dates`; it cannot convert Coptic yet, so a Coptic day reads as the ISO `YYYY-MM-DD`.
- `parseDhis2Calendar` reads `systemInfo.calendar`; an unknown or missing calendar is Gregorian.
- It only formats; it does not fetch option sets, org unit names or metadata.
