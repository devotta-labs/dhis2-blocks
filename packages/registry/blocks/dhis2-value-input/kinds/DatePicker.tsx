import i18n from '@dhis2/d2-i18n'
import {
    useDatePicker,
    useResolvedDirection,
} from '@dhis2/multi-calendar-dates'
import { IconChevronLeft16, IconChevronRight16 } from '@dhis2/ui-icons'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { PopoverTitle } from '@/components/dhis2/ui/popover'

type PickerCalendar = NonNullable<
    Parameters<typeof useDatePicker>[0]['options']['calendar']
>
type Day = ReturnType<typeof useDatePicker>['calendarWeekDays'][number][number]

/**
 * Where focus goes after a key: a day shown in the grid before the move, the day `offset` places from `from` (or, when
 * `from` is gone, the day at `at` past the grid's edge, counted from the end when negative), or the `nth` day of the
 * month, the last day if the month is shorter.
 */
type Target =
    | { date: string }
    | { from: string; offset: number; at: number }
    | { nth: number }

type Direction = ReturnType<typeof useResolvedDirection>

// Arrows move in visual order: right to left, the week runs from the right, so Left is the next day.
const OFFSETS = {
    ltr: new Map([
        ['ArrowLeft', -1],
        ['ArrowRight', 1],
        ['ArrowUp', -7],
        ['ArrowDown', 7],
    ]),
    rtl: new Map([
        ['ArrowLeft', 1],
        ['ArrowRight', -1],
        ['ArrowUp', -7],
        ['ArrowDown', 7],
    ]),
} satisfies Record<Direction, ReadonlyMap<string, number>>

// Forced colours would repaint the fill as the page, so the picked day takes system colours there.
const PICKED =
    'bg-dhis2-primary text-dhis2-primary-foreground hover:bg-dhis2-primary-strong forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:[forced-color-adjust:none]'

/**
 * A month of days in the system calendar, from `useDatePicker`, with the grid's keys: arrows move a day or a week, Page
 * Up and Page Down a month, Enter or a click picks. `date` is the day shown as picked, typed in the system calendar and
 * date format, or empty for none. `day` is given the button that takes focus when the picker opens. `dir` is the
 * direction of the page around the field, if it sets one; otherwise the language's.
 */
export const DatePicker = ({
    date,
    settings,
    pick,
    day: activeRef,
    dir,
}: {
    date: string
    settings: ValueSettings
    pick(text: string): void
    day: RefObject<HTMLButtonElement>
    dir: Direction | undefined
}) => {
    const titleId = useId()
    const direction = useResolvedDirection(dir, i18n.language)
    const options = useMemo(
        () => ({
            // SAFETY: the hook maps DHIS2's calendar names itself; its types list only the names it maps them to.
            calendar: settings.calendar as PickerCalendar,
            locale: i18n.language,
            // Narrow labels repeat (two Ts), and keys must not.
            weekDayFormat: 'short' as const,
        }),
        [settings.calendar]
    )
    const picker = useDatePicker({
        date,
        format: settings.dateFormat,
        options,
        onDateSelect: (payload) => {
            if (payload !== null) {
                pick(payload.calendarDateString)
            }
        },
    })
    const [target, setTarget] = useState<Target>()
    const moved = useRef(false)
    const days = picker.calendarWeekDays.flat()
    const month = days.filter((shown) => shown.isInCurrentMonth)

    const landing = (to: Target | undefined): Day | undefined => {
        if (to === undefined) {
            return undefined
        }
        if ('nth' in to) {
            return month[Math.min(to.nth, month.length - 1)]
        }
        if ('date' in to) {
            return days.find((shown) => shown.dateValue === to.date)
        }
        const from = days.findIndex((shown) => shown.dateValue === to.from)
        return from === -1 ? days.at(to.at) : days[from + to.offset]
    }
    const active =
        [
            landing(target),
            days.find((shown) => shown.isSelected),
            days.find((shown) => shown.isToday),
        ].find((shown) => shown?.isInCurrentMonth) ?? month[0]

    useEffect(() => {
        if (moved.current) {
            moved.current = false
            activeRef.current?.focus()
        }
    })

    const onKeyDown = (event: KeyboardEvent, shown: Day) => {
        const index = days.indexOf(shown)
        const offset = OFFSETS[direction].get(event.key)
        let next: Target
        let navigate: (() => void) | undefined
        if (event.key === 'PageUp' || event.key === 'PageDown') {
            next = { nth: month.indexOf(shown) }
            navigate =
                event.key === 'PageUp'
                    ? picker.prevMonth.navigateTo
                    : picker.nextMonth.navigateTo
        } else if (offset === undefined) {
            return
        } else {
            const to = index + offset
            const there = days[to]
            next = there
                ? { date: there.dateValue }
                : {
                      from: shown.dateValue,
                      offset,
                      at: to < 0 ? to : to - days.length,
                  }
            if (!there?.isInCurrentMonth) {
                navigate =
                    to < days.indexOf(month[0] ?? shown)
                        ? picker.prevMonth.navigateTo
                        : picker.nextMonth.navigateTo
            }
        }
        event.preventDefault()
        moved.current = true
        navigate?.()
        setTarget(next)
    }

    const title = `${picker.currMonth.label ?? ''} ${picker.currYear.label}`
    return (
        // The popup is portalled out of the page's direction, so it carries its own.
        <div dir={direction} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <Button
                    variant="secondary"
                    size="icon-sm"
                    aria-label={i18n.t('Previous month')}
                    onClick={() => {
                        setTarget(undefined)
                        picker.prevMonth.navigateTo()
                    }}
                >
                    <span className="flex rtl:rotate-180">
                        <IconChevronLeft16 />
                    </span>
                </Button>
                {/* Names the picker's dialog as well as its grid. */}
                <PopoverTitle id={titleId} className="text-sm">
                    {title}
                </PopoverTitle>
                <Button
                    variant="secondary"
                    size="icon-sm"
                    aria-label={i18n.t('Next month')}
                    onClick={() => {
                        setTarget(undefined)
                        picker.nextMonth.navigateTo()
                    }}
                >
                    <span className="flex rtl:rotate-180">
                        <IconChevronRight16 />
                    </span>
                </Button>
            </div>
            <table
                // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- the ARIA grid pattern on a table: arrow keys move between days
                role="grid"
                aria-labelledby={titleId}
                className="border-collapse"
            >
                <thead>
                    <tr>
                        {picker.weekDayLabels.map((label) => (
                            <th
                                key={label}
                                scope="col"
                                className="pb-1 text-xs font-normal text-dhis2-muted-foreground"
                            >
                                {label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {picker.calendarWeekDays.map((week) => (
                        <tr key={week[0]?.dateValue}>
                            {week.map((shown) => (
                                <td
                                    key={shown.dateValue}
                                    aria-selected={Boolean(shown.isSelected)}
                                    className="p-0"
                                >
                                    {shown.isInCurrentMonth ? (
                                        <button
                                            type="button"
                                            ref={
                                                shown === active
                                                    ? activeRef
                                                    : undefined
                                            }
                                            tabIndex={shown === active ? 0 : -1}
                                            aria-label={`${shown.label} ${title}`}
                                            aria-current={
                                                shown.isToday
                                                    ? 'date'
                                                    : undefined
                                            }
                                            onClick={shown.onClick}
                                            onKeyDown={(event) =>
                                                onKeyDown(event, shown)
                                            }
                                            className={cn(
                                                'flex size-9 cursor-pointer items-center justify-center rounded-dhis2-sm border border-transparent bg-transparent text-sm text-dhis2-foreground hover:bg-dhis2-muted focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring',
                                                // Forced colours would give every day the same edge.
                                                shown.isToday &&
                                                    'border-dhis2-primary forced-colors:border-[Highlight]',
                                                shown.isSelected && PICKED
                                            )}
                                        >
                                            {shown.label}
                                        </button>
                                    ) : null}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
