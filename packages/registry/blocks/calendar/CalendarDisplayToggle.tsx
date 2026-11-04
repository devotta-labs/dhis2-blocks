import i18n from '@dhis2/d2-i18n'
import React, { type ComponentProps } from 'react'
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/dhis2/ui/toggle-group'
import { useCalendar } from './context'

/**
 * Lets users switch days between counts and names. Leave it out to keep the
 * calendar on the display the app chose.
 */
export const CalendarDisplayToggle = (
    props: Omit<
        ComponentProps<typeof ToggleGroup>,
        'value' | 'defaultValue' | 'onValueChange' | 'children'
    >
) => {
    const {
        state: { display },
        actions: { setDisplay },
    } = useCalendar()
    return (
        <ToggleGroup
            aria-label={i18n.t('Show in each day')}
            variant="outline"
            size="sm"
            {...props}
            data-slot="calendar-display-toggle"
            value={[display]}
        >
            <ToggleGroupItem
                value="counts"
                onClick={() => setDisplay('counts')}
            >
                {i18n.t('Counts')}
            </ToggleGroupItem>
            <ToggleGroupItem
                value="records"
                onClick={() => setDisplay('records')}
            >
                {i18n.t('Names')}
            </ToggleGroupItem>
        </ToggleGroup>
    )
}
