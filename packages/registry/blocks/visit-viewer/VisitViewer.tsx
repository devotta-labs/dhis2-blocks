import React, {
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useState,
    type ComponentProps,
} from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import { SectionLabel, VisitViewerContext } from './context'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type HeadingProps = ComponentProps<'h2'> & {
    /** The heading's level in your page's outline. */
    level?: HeadingLevel
}

const HEADINGS = {
    1: 'h1',
    2: 'h2',
    3: 'h3',
    4: 'h4',
    5: 'h5',
    6: 'h6',
} as const satisfies Record<HeadingLevel, string>

const useSectionLabel = () => {
    const [labelId, setLabelId] = useState<string>()
    const register = useCallback((id: string | undefined) => setLabelId(id), [])
    return { labelId, register }
}

const useNamesSection = (id: string) => {
    const register = useContext(SectionLabel)
    useEffect(() => {
        if (register === undefined) {
            return undefined
        }
        register(id)
        return () => register(undefined)
    }, [register, id])
}

const SectionHeading = ({
    level,
    id,
    ...props
}: HeadingProps & { level: HeadingLevel }) => {
    const generatedId = useId()
    const headingId = id ?? generatedId
    useNamesSection(headingId)
    const Heading = HEADINGS[level]
    return <Heading id={headingId} {...props} />
}

export interface VisitViewerProps extends ComponentProps<'section'> {
    /** The DHIS2 system calendar nested `VisitDate`s format in. */
    calendar?: Dhis2Calendar
    /** The locale for Gregorian month names; the browser's by default. */
    locale?: string
}

/**
 * The visit view: a section that sets the calendar and locale every nested
 * `VisitDate` formats in. It never fetches, filters or sorts; compose the
 * visits you have as its children.
 */
export const VisitViewer = ({
    calendar = 'gregorian',
    locale,
    className,
    ...props
}: VisitViewerProps) => {
    const settings = useMemo(() => ({ calendar, locale }), [calendar, locale])
    const { labelId, register } = useSectionLabel()
    return (
        <VisitViewerContext.Provider value={settings}>
            <SectionLabel.Provider value={register}>
                <section
                    aria-labelledby={labelId}
                    data-slot="visit-viewer"
                    className={cn(
                        'flex min-w-0 flex-col gap-4 text-sm text-dhis2-foreground',
                        className
                    )}
                    {...props}
                />
            </SectionLabel.Provider>
        </VisitViewerContext.Provider>
    )
}

/** A row with the title and description at the start and actions at the end. */
export const VisitViewerHeader = ({
    className,
    ...props
}: ComponentProps<'div'>) => (
    <div
        data-slot="visit-viewer-header"
        className={cn(
            'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1',
            className
        )}
        {...props}
    />
)

/** The view's heading; it names the `VisitViewer` section. A level 2 heading unless you pass `level`. */
export const VisitViewerTitle = ({
    className,
    level = 2,
    ...props
}: HeadingProps) => (
    <SectionHeading
        level={level}
        data-slot="visit-viewer-title"
        className={cn(
            'col-start-1 m-0 text-base leading-snug font-medium text-dhis2-foreground',
            className
        )}
        {...props}
    />
)

export const VisitViewerDescription = ({
    className,
    ...props
}: ComponentProps<'p'>) => (
    <p
        data-slot="visit-viewer-description"
        className={cn(
            'col-start-1 m-0 text-sm text-dhis2-muted-foreground',
            className
        )}
        {...props}
    />
)

/** Your buttons or links for the whole view, at the end of the header. */
export const VisitViewerActions = ({
    className,
    ...props
}: ComponentProps<'div'>) => (
    <div
        data-slot="visit-viewer-actions"
        className={cn(
            'col-start-2 row-span-2 row-start-1 flex flex-wrap items-center justify-end gap-2 self-start',
            className
        )}
        {...props}
    />
)

/** A bar for your own filters, search or view toggles. */
export const VisitViewerToolbar = ({
    className,
    ...props
}: ComponentProps<'div'>) => (
    <div
        data-slot="visit-viewer-toolbar"
        className={cn('flex flex-wrap items-center gap-2', className)}
        {...props}
    />
)

/** A section for visits you grouped, such as Overdue, Upcoming or Past; its label names it. */
export const VisitViewerGroup = ({
    className,
    ...props
}: ComponentProps<'section'>) => {
    const { labelId, register } = useSectionLabel()
    return (
        <SectionLabel.Provider value={register}>
            <section
                aria-labelledby={labelId}
                data-slot="visit-viewer-group"
                className={cn('flex min-w-0 flex-col gap-2', className)}
                {...props}
            />
        </SectionLabel.Provider>
    )
}

/** The group's heading. A level 3 heading unless you pass `level`. */
export const VisitViewerGroupLabel = ({
    className,
    level = 3,
    ...props
}: HeadingProps) => (
    <SectionHeading
        level={level}
        data-slot="visit-viewer-group-label"
        className={cn(
            'm-0 text-xs leading-snug font-medium tracking-wide text-dhis2-muted-foreground uppercase',
            className
        )}
        {...props}
    />
)

/** Shown when there are no visits to show; your copy and actions are its children. */
export const VisitViewerEmpty = ({
    className,
    ...props
}: ComponentProps<'div'>) => (
    <div
        data-slot="visit-viewer-empty"
        className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-dhis2-md border border-dashed border-dhis2-border px-4 py-8 text-center text-sm text-dhis2-muted-foreground',
            className
        )}
        {...props}
    />
)
