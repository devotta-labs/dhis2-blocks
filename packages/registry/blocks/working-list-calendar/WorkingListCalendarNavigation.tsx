import i18n from '@dhis2/d2-i18n'
import { IconChevronLeft16, IconChevronRight16 } from '@dhis2/ui-icons'
import React, { type ComponentPropsWithoutRef } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import { useWorkingListCalendar } from './WorkingListCalendar'

/** Previous and next month around month and year selects. */
export const WorkingListCalendarNavigation = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'nav'>) => {
    const { navigation, visibleMonth, atFilterStart, atFilterEnd } =
        useWorkingListCalendar()
    const year = Number(navigation.currYear.value)

    return (
        <nav
            aria-label={i18n.t('Month')}
            {...props}
            data-slot="working-list-calendar-navigation"
            className={cn('flex items-center gap-2', className)}
        >
            <Button
                variant="secondary"
                size="field-dense"
                aria-label={i18n.t('Previous month')}
                disabled={atFilterStart}
                onClick={navigation.prevMonth.navigateTo}
            >
                <span className="flex rtl:rotate-180">
                    <IconChevronLeft16 />
                </span>
            </Button>
            <Select
                items={navigation.months}
                value={visibleMonth}
                onValueChange={(month) => {
                    if (month !== null) navigation.navigateToMonth(month)
                }}
            >
                <SelectTrigger
                    size="sm"
                    aria-label={i18n.t('Month')}
                    className="w-36"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {navigation.months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                            {month.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                items={navigation.years}
                value={year}
                onValueChange={(next) => {
                    if (next !== null) navigation.navigateToYear(next)
                }}
            >
                <SelectTrigger
                    size="sm"
                    aria-label={i18n.t('Year')}
                    className="w-24"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {navigation.years.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button
                variant="secondary"
                size="field-dense"
                aria-label={i18n.t('Next month')}
                disabled={atFilterEnd}
                onClick={navigation.nextMonth.navigateTo}
            >
                <span className="flex rtl:rotate-180">
                    <IconChevronRight16 />
                </span>
            </Button>
        </nav>
    )
}
