import { cn } from '@/components/dhis2/ui/cn'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/dhis2/ui/tooltip'
import i18n from '@dhis2/d2-i18n'
import { IconWarningFilled16 } from '@dhis2/ui-icons'
import React, {
    useLayoutEffect,
    useState,
    type ComponentPropsWithoutRef,
} from 'react'
import type { ObservationPoint } from '../api/types'
import { useObservationCard } from '../card/context'
import { CardNote, FOOTER_BAND, STALE_BAND } from '../card/frame'
import {
    formatRecordedDate,
    NO_ESCAPE,
    relativeTime,
    type DisplayOptions,
} from '../format/display'

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

/**
 * A tooltip that opens at once on click or tap, as well as on hover after the
 * usual delay, so the full text is one click away and reachable on touch.
 */
const useClickableTooltip = () => {
    const [open, setOpen] = useState(false)
    return {
        root: { open, onOpenChange: setOpen },
        trigger: { closeOnClick: false, onClick: () => setOpen(true) },
    }
}

/**
 * When a reading was recorded, as "3 days ago", followed by "Out of date" once
 * it is. Clicking, focusing or hovering it shows the date and program stage;
 * a screen reader hears those in full instead of the short form.
 */
export function RecordedNote({
    point,
    staleAfterDays,
    stale,
    now,
    display,
}: {
    point: ObservationPoint
    staleAfterDays?: number
    stale: boolean
    now: Date
    display: DisplayOptions
}) {
    const recorded = i18n.t('Recorded {{date}} · {{stage}}', {
        date: formatRecordedDate(point, display),
        stage: point.source.programStageName,
        interpolation: NO_ESCAPE,
    })
    const tooltip = useClickableTooltip()

    return (
        <Tooltip {...tooltip.root}>
            <TooltipTrigger
                {...tooltip.trigger}
                render={
                    <span
                        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a tooltip trigger: focus shows the detail to keyboard users
                        tabIndex={0}
                        data-slot="recorded-note"
                        className="inline-flex cursor-default flex-wrap items-center gap-x-2 gap-y-1 rounded-dhis2-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-dhis2-ring"
                    />
                }
            >
                {/* A dotted underline says there is more on hover or focus. */}
                <span
                    aria-hidden="true"
                    className="underline decoration-current/40 decoration-dotted underline-offset-2"
                >
                    {relativeTime(point, now, display.locale)}
                </span>
                <span className="sr-only">{recorded}</span>
                {stale && staleAfterDays !== undefined ? (
                    <span
                        data-slot="stale-note"
                        className="inline-flex items-center gap-1 font-medium text-dhis2-warning"
                    >
                        <span
                            aria-hidden="true"
                            className="inline-flex [&_svg]:size-3.5"
                        >
                            <IconWarningFilled16 />
                        </span>
                        <span aria-hidden="true">{i18n.t('Out of date')}</span>
                        <span className="sr-only">
                            {staleNote(staleAfterDays)}
                        </span>
                    </span>
                ) : null}
            </TooltipTrigger>
            <TooltipContent>
                <span className="block">{recorded}</span>
                {stale && staleAfterDays !== undefined ? (
                    <span className="block">{staleNote(staleAfterDays)}</span>
                ) : null}
            </TooltipContent>
        </Tooltip>
    )
}

/**
 * The note shown when the user can't read some stages that capture the value:
 * "Restricted access", with the full reason on click, focus or hover. A screen reader
 * hears the full reason instead. Internal: the card's footer and the inline reading use it.
 */
export function PartialNote({ className }: { className?: string }) {
    const reason = i18n.t('Some visits are hidden by your access')
    const tooltip = useClickableTooltip()
    return (
        <Tooltip {...tooltip.root}>
            <TooltipTrigger
                {...tooltip.trigger}
                render={
                    <span
                        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a tooltip trigger: focus shows the detail to keyboard users
                        tabIndex={0}
                        data-slot="partial-note"
                        className={cn(
                            'ms-auto inline-flex cursor-default rounded-dhis2-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-dhis2-ring',
                            className
                        )}
                    />
                }
            >
                <span aria-hidden="true" className="inline-flex">
                    <CardNote tone="info">
                        {i18n.t('Restricted access')}
                    </CardNote>
                </span>
                <span className="sr-only">{reason}</span>
            </TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
    )
}

export type ObservationRecordedProps = Omit<
    ComponentPropsWithoutRef<'div'>,
    'children'
>

/** Internal: the recorded band, also what the card renders when no part placed one. */
export function RecordedFooter({
    className,
    ...props
}: ObservationRecordedProps) {
    const { series, staleAfterDays, stale, now, display } = useObservationCard()
    const { latest, partial } = series
    if (latest === undefined && !partial) {
        return null
    }
    return (
        <div
            {...props}
            data-slot="observation-recorded"
            className={cn(FOOTER_BAND, stale && STALE_BAND, className)}
        >
            {latest ? (
                <RecordedNote
                    point={latest}
                    staleAfterDays={staleAfterDays}
                    stale={stale}
                    now={now}
                    display={display}
                />
            ) : null}
            {partial ? <PartialNote /> : null}
        </div>
    )
}

/**
 * When the latest reading was recorded and in which stage, with the stale and
 * partial-access notes. The card shows it even when it isn't placed, so a
 * value is never shown without its date.
 */
export function ObservationRecorded(props: ObservationRecordedProps) {
    const { registerRecorded } = useObservationCard()
    // Before paint, so the card's own band never flashes in beside this one.
    useLayoutEffect(() => registerRecorded(), [registerRecorded])
    return <RecordedFooter {...props} />
}
