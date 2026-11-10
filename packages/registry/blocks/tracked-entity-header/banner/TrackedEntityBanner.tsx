import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import i18n from '@dhis2/d2-i18n'
import React, { type ReactNode } from 'react'
import { TrackedEntityAttribute } from '../parts/TrackedEntityAttribute'
import { TrackedEntityDetails } from '../parts/TrackedEntityDetails'
import { TrackedEntityStatus } from '../parts/TrackedEntityStatus'
import { useHeaderContext } from '../provider/context'

export interface TrackedEntityBannerProps {
    /** The parts to show; without children, the program's list attributes, the tags and the details. */
    children?: ReactNode
    className?: string
}

/**
 * Line one is everything up to the facts, with the actions at its end; the
 * facts take line two and the details open below both.
 */
const PLACEMENT =
    'flex flex-wrap items-baseline gap-x-4 gap-y-1.5 [&>[data-slot=tracked-entity-actions]]:ms-auto [&>[data-slot=tracked-entity-details]]:basis-full [&>[data-slot=tracked-entity-facts]]:basis-full'

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

/** One person as a strip of parts, with the loading, failed and restricted states drawn for them. */
export function TrackedEntityBanner({
    children,
    className,
}: TrackedEntityBannerProps) {
    const { state, nameId, programName } = useHeaderContext()
    const ready = state.status === 'ready'
    const inactive = ready && state.trackedEntity.inactive
    // A mounted name part labels the region; without one, the type name; until the person is ready, a generic name.
    const labelledBy = ready ? nameId : undefined
    let label: string | undefined = i18n.t('Person record')
    if (ready) {
        label = nameId ? undefined : state.metadata.typeName
    }

    const content = (() => {
        switch (state.status) {
            case 'loading':
                return <LoadingContent />
            case 'failed':
                return (
                    <>
                        <Message>{i18n.t("Couldn't load this person")}</Message>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={state.retry}
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
                                      "You don't have access to this person's record in {{program}}",
                                      {
                                          program: programName,
                                          interpolation: { escapeValue: false },
                                      }
                                  )
                                : i18n.t(
                                      "You don't have access to this person's record"
                                  )}
                        </Message>
                        {/* Only the actions render here, so a host's "Request access" still shows. */}
                        {children}
                    </>
                )
            default:
                return (
                    children ?? (
                        <DefaultArrangement
                            listOrder={state.metadata.listOrder}
                        />
                    )
                )
        }
    })()

    return (
        <section
            data-slot="tracked-entity-banner"
            aria-labelledby={labelledBy}
            aria-label={label}
            aria-busy={state.status === 'loading' || undefined}
            data-tone={inactive ? 'inactive' : 'default'}
            className={cn(
                PLACEMENT,
                'rounded-dhis2-md border border-dhis2-border-strong bg-dhis2-card px-3.5 py-2.5 text-dhis2-card-foreground',
                inactive && 'bg-dhis2-muted',
                className
            )}
        >
            {content}
        </section>
    )
}
