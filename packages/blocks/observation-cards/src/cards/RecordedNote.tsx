import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/registry/dhis2/ui/tooltip'
import i18n from '@dhis2/d2-i18n'
import { IconWarningFilled16 } from '@dhis2/ui-icons'
import React from 'react'
import type { ObservationPoint } from '../use-tracked-entity-observations'
import { intlLocale, useFormatDate } from './calendar'
import { NO_ESCAPE, isStale, relativeTime } from './format'

/**
 * One key per English plural form: d2-app-scripts cannot extract `count`
 * plurals, so the form is picked here. `count` still reaches i18next for a
 * translation that defines its own plural forms.
 */
const staleNote = (days: number): string =>
    days === 1
        ? i18n.t('Out of date: last recorded over {{count}} day ago', {
              count: days,
              interpolation: NO_ESCAPE,
          })
        : i18n.t('Out of date: last recorded over {{count}} days ago', {
              count: days,
              interpolation: NO_ESCAPE,
          })

export interface RecordedNoteProps {
    point: ObservationPoint
    /** Days after which the reading counts as out of date. Off when unset. */
    staleAfterDays?: number
}

/**
 * When a reading was recorded, as "3 days ago", with a warning icon once it is
 * out of date. Hovering or focusing it shows the date and program stage; a
 * screen reader hears those in full instead of the short form.
 */
export function RecordedNote({ point, staleAfterDays }: RecordedNoteProps) {
    const formatDate = useFormatDate()
    // Read per render so tests can stub the clock.
    const now = new Date()
    const stale =
        staleAfterDays !== undefined && isStale(point, staleAfterDays, now)
    const recorded = i18n.t('Recorded {{date}} · {{stage}}', {
        date: formatDate(point.occurredAt),
        stage: point.source.programStageName,
        interpolation: NO_ESCAPE,
    })

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <span
                        tabIndex={0}
                        data-slot="recorded-note"
                        className="inline-flex cursor-default items-center gap-1 rounded-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-dhis2-primary"
                    />
                }
            >
                <span aria-hidden="true">
                    {relativeTime(point, now, intlLocale())}
                </span>
                <span className="sr-only">{recorded}</span>
                {stale ? (
                    <span
                        data-slot="stale-note"
                        className="inline-flex text-dhis2-yellow-800"
                    >
                        <span
                            aria-hidden="true"
                            className="inline-flex [&_svg]:size-3.5"
                        >
                            <IconWarningFilled16 />
                        </span>
                        <span className="sr-only">
                            {staleNote(staleAfterDays)}
                        </span>
                    </span>
                ) : null}
            </TooltipTrigger>
            <TooltipContent>
                <span className="block">{recorded}</span>
                {stale ? (
                    <span className="block">{staleNote(staleAfterDays)}</span>
                ) : null}
            </TooltipContent>
        </Tooltip>
    )
}
