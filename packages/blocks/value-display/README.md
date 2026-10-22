# DHIS2 Value Display

Read-only formatting of DHIS2 values and calendar dates. Pure functions with no
React: option sets show option names, other values are formatted by value type,
and dates are shown in the system calendar on the day they were stored.

## Install

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/dhis2-value-display
```

## Use

```ts
import {
    formatDhis2Value,
    parseDhis2Calendar,
} from '@/components/dhis2/value-display'

const text = formatDhis2Value(
    '2026-10-14T23:30:00.000',
    { valueType: 'DATETIME' },
    { calendar: parseDhis2Calendar(systemInfo?.calendar), locale: 'en' }
)
// "Oct 14, 2026 23:30"
```
