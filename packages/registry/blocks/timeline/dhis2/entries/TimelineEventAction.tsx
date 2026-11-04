import i18n from '@dhis2/d2-i18n'
import React, {
    createContext,
    useContext,
    type ComponentPropsWithoutRef,
} from 'react'
import { Button, buttonVariants } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'

/** The surrounding event's name: "ANC 1st visit, 12 Jun 2026". */
export const TimelineEventNameContext = createContext<string | undefined>(
    undefined
)

const ACTION = cn(
    buttonVariants({ variant: 'link', size: 'sm' }),
    'h-auto border-0 p-0 text-sm! leading-5 tracking-normal'
)

/**
 * A text action in the event's action row, styled like "Show changes": the
 * host's "Open", say. With `href` it renders a link, otherwise a button.
 * Inside an event entry, its label is named after the event too ("Open,
 * ANC 1st visit, 12 Jun 2026"), so a list of every "Open" on the page tells
 * them apart; an `aria-label` of your own replaces that.
 */
export const TimelineEventAction = (
    props: { children: string } & (
        | ({ href?: undefined } & Omit<
              ComponentPropsWithoutRef<typeof Button>,
              'children'
          >)
        | ({ href: string } & Omit<ComponentPropsWithoutRef<'a'>, 'children'>)
    )
) => {
    const event = useContext(TimelineEventNameContext)
    const named =
        event === undefined ||
        props['aria-label'] !== undefined ||
        props['aria-labelledby'] !== undefined
            ? {}
            : {
                  'aria-label': i18n.t('{{action}}, {{event}}', {
                      action: props.children,
                      event,
                  }),
              }
    if (props.href !== undefined) {
        return (
            <a
                {...props}
                {...named}
                data-slot="timeline-event-action"
                className={cn(ACTION, props.className)}
            />
        )
    }
    return (
        <Button
            type="button"
            {...props}
            {...named}
            variant="link"
            size="sm"
            data-slot="timeline-event-action"
            className={cn(ACTION, props.className)}
        />
    )
}
