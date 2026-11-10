import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import i18n from '@dhis2/d2-i18n'
import React, { useMemo, useRef, useState, type ReactNode } from 'react'
import { TrackedEntityAttribute } from '../parts/TrackedEntityAttribute'
import { TrackedEntityDetails } from '../parts/TrackedEntityDetails'
import { TrackedEntityStatus } from '../parts/TrackedEntityStatus'
import { DIVIDED } from '../parts/divided'
import { ActionsSlotContext } from '../provider/actionsSlot'
import { useHeaderContext } from '../provider/context'
import { LabelledRegionContext } from '../provider/labelledRegion'

export interface TrackedEntityBannerProps {
    /** The parts to show; without children, the program's list attributes, the tags and the details. */
    children?: ReactNode
    className?: string
}

/**
 * Line one is everything up to the facts; the facts take line two and the
 * details open below both.
 */
const PLACEMENT = cn(
    'flex min-w-0 flex-1 flex-wrap items-baseline gap-y-1.5 [&>[data-slot=tracked-entity-details]]:basis-full [&>[data-slot=tracked-entity-facts]]:basis-full',
    DIVIDED
)

/** The actions' own column, beside both lines; under everything when the banner is narrow. */
const COLUMNS = 'flex flex-col gap-x-4 gap-y-2 @md:flex-row @md:items-start'

const Message = ({ children }: { children: string }) => (
    <p className="m-0 text-sm text-dhis2-foreground">{children}</p>
)

/** The loading banner, two lines like the loaded one: the name's height, then a fact's. */
const LoadingContent = () => (
    <>
        <span className="sr-only">{i18n.t('Loading')}</span>
        <Skeleton className="h-7 w-48 max-w-full" />
        <div className="basis-full">
            <Skeleton className="h-5 w-72 max-w-full" />
        </div>
    </>
)

const DefaultArrangement = ({ listOrder }: { listOrder: string[] }) => (
    <>
        {listOrder.map((uid) => (
            <TrackedEntityAttribute key={uid} attribute={uid} />
        ))}
        <TrackedEntityStatus />
        <TrackedEntityDetails />
    </>
)

/** One tracked entity as a strip of parts, with the loading, failed and restricted states drawn for them. */
export function TrackedEntityBanner({
    children,
    className,
}: TrackedEntityBannerProps) {
    const { state, programName } = useHeaderContext()
    // The id of a name part inside this banner; parts elsewhere never set it.
    const [nameId, setNameId] = useState<string>()
    const section = useRef<HTMLElement>(null)
    const [actionsColumn, setActionsColumn] = useState<HTMLDivElement | null>(
        null
    )
    const actionsSlot = useMemo(
        () => ({ element: actionsColumn }),
        [actionsColumn]
    )
    const ready = state.status === 'ready'
    const inactive = ready && state.trackedEntity.inactive
    // A mounted name part labels the region; without one, the type name; until the record is ready, a generic name.
    const labelledBy = ready ? nameId : undefined
    let label: string | undefined = i18n.t('Record')
    if (ready) {
        label = nameId ? undefined : state.metadata.typeName || label
    }
    const hasChildren =
        children !== undefined && children !== null && children !== false

    const content = (() => {
        switch (state.status) {
            case 'loading':
                return <LoadingContent />
            case 'failed':
                return (
                    <>
                        <Message>{i18n.t("Couldn't load this record")}</Message>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                // The button goes when the retry starts; focus stays in the banner.
                                section.current?.focus()
                                state.retry()
                            }}
                        >
                            {i18n.t('Retry')}
                        </Button>
                    </>
                )
            case 'restricted':
                return (
                    <>
                        <Message>
                            {programName
                                ? i18n.t(
                                      "You don't have access to this record in {{program}}",
                                      {
                                          program: programName,
                                          interpolation: { escapeValue: false },
                                      }
                                  )
                                : i18n.t(
                                      "You don't have access to this record"
                                  )}
                        </Message>
                        {/* Mounted but hidden: only the actions, drawn in their own column, show, so a host's "Request access" still does. */}
                        <div hidden>{children}</div>
                    </>
                )
            case 'not-found':
                return <Message>{i18n.t("This record doesn't exist")}</Message>
            default:
                return hasChildren ? (
                    children
                ) : (
                    <DefaultArrangement listOrder={state.metadata.listOrder} />
                )
        }
    })()

    return (
        <section
            ref={section}
            tabIndex={-1}
            data-slot="tracked-entity-banner"
            aria-labelledby={labelledBy}
            aria-label={label}
            aria-busy={state.status === 'loading' || undefined}
            data-tone={inactive ? 'inactive' : 'default'}
            className={cn(
                '@container outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-dhis2-ring focus-visible:outline-solid',
                'rounded-dhis2-md border border-dhis2-border-strong bg-dhis2-card px-3.5 py-2.5 text-dhis2-card-foreground',
                inactive && 'bg-dhis2-muted',
                className
            )}
        >
            <div className={COLUMNS}>
                <div
                    data-slot="tracked-entity-banner-content"
                    className={PLACEMENT}
                >
                    <LabelledRegionContext.Provider value={setNameId}>
                        <ActionsSlotContext.Provider value={actionsSlot}>
                            {content}
                        </ActionsSlotContext.Provider>
                    </LabelledRegionContext.Provider>
                </div>
                {/* Empty, and so hidden, until the actions arrive. */}
                <div
                    ref={setActionsColumn}
                    className="flex shrink-0 empty:hidden"
                />
            </div>
        </section>
    )
}
