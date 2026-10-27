# DHIS2 Value Types

How each DHIS2 value type is typed, checked, pasted and shown for editing. Pure functions with no React: what kind of cell a field is, what a person may type or paste, the problem when it does not fit, and the text an editable cell shows. Dates are typed and shown in the system calendar and date format. It builds on `dhis2-value-display` for the calendar.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/dhis2-value-types
```

## Describe a field

A `Field` is a value type, with its `options` for an option set (code and name) and its `fieldMask` when the data element has one. `ValueSettings` is the system calendar (`systemInfo.calendar`, through `parseDhis2Calendar` from `dhis2-value-display`) and date format (`systemInfo.dateFormat`, through `parseDateFormat`).

```ts
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import {
    cellKind,
    parseDateFormat,
    parseTyped,
    typedText,
    type ValueSettings,
} from '@/components/dhis2-value-types'

const settings: ValueSettings = {
    calendar: parseDhis2Calendar('ethiopian'),
    dateFormat: parseDateFormat('dd-MM-yyyy'),
}

cellKind({ valueType: 'DATE' }) // "date"
typedText({ valueType: 'DATE' }, '2026-10-14', settings) // "04-02-2019"
parseTyped({ valueType: 'DATE' }, '04-02-2019', settings)
// { ok: true, value: '2026-10-14' }
parseTyped({ valueType: 'NUMBER' }, '1,5', settings)
// { ok: false, problem: { code: 'decimalComma', message: 'Use a full stop for decimals' } }
```

## API

```ts
cellKind(field): CellKind // text, number, date, dateTime, time, boolean, trueOnly, option, popup or readOnly
inputModeFor(field): InputMode | undefined // the keyboard for a typed cell
parseTyped(field, text, settings): TypedValue // typed or pasted text -> the stored value, or a problem
typedText(field, value, settings): string // a stored value -> what an editable cell shows
checkStored(field, value): ValueProblem | undefined // a stored value today's rules reject
parseDateFormat(systemInfoDateFormat): DateFormat
optionIndex(options): OptionIndex // the search text for an option list, built once per list and cached
searchOptions(index, query, limit = OPTION_LIMIT): { codes, total } // every word must match; exact code first, then code starts, then word starts
```

`ValueProblem.message` is translated with `@dhis2/d2-i18n` when the problem arises, in the language set then; `code` is stable.

## Boundaries

- Blank text is no value (`value: undefined`), never a problem. Whether a value is required is not decided here.
- Numbers are stored in the form DHIS2 accepts: `00012` becomes `12`, `-0` becomes `0`, `.5` becomes `0.5` and `5.` becomes `5`; the digits after the point stay as typed (`2.50`). Exponents (`1e3`) are refused, and whole numbers must be safe integers. A decimal comma is refused rather than guessed, so "1,234" is never misread. `checkStored` flags stored numbers that are not in that form.
- Phone numbers take digits, spaces and `+ ( ) # . / -`, up to 50 characters.
- Yes/No fields read `yes`, `no`, `true`, `false`, `x`, `1` and `0` in any case. A yes-only field clears on a "no".
- An option is found by code or by name, in any case, and a code wins over another option's name. An editable cell shows an option's name only when typing that name finds the same option, otherwise its code. A multi-select reads comma separated options.
- A field mask (DHIS2's TextPattern: `\d` digit, `\x` lower case, `\X` capital, `\w` letter or digit, also inside `[...]`; the rest a regular expression) must match the whole value. A blank mask, or one that is not a valid pattern, never blocks entry.
- A date is converted through the system calendar and must convert back to itself, so a day the calendar does not have is refused. A date time is typed as the date, a space and `HH:mm`; a time may have a one-digit hour (`9:30` is stored `09:30`).
- Pop-up types (`LONG_TEXT`, `MULTI_TEXT`, `AGE`, `COORDINATE`, `ORGANISATION_UNIT`, `USERNAME`, `FILE_RESOURCE`, `IMAGE`) are checked and shown in their stored form. A value type this block does not know is `readOnly`.
- It does not format values for reading; `dhis2-value-display` does.
