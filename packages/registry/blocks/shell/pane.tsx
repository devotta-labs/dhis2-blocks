import { cn } from '@/components/dhis2/ui/cn'
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useState,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from 'react'
import {
    Group,
    Panel,
    Separator,
    usePanelRef,
    type GroupProps,
    type PanelProps,
    type SeparatorProps,
} from 'react-resizable-panels'
import { BAR_HEIGHT, DENSITY, type Density } from './density'

type Orientation = NonNullable<GroupProps['orientation']>
type Side = 'start' | 'end'

/** The orientation of the group a pane is in; undefined outside one. */
const PaneGroupContext = createContext<Orientation | undefined>(undefined)

interface PaneContextValue {
    orientation: Orientation
    side: Side
    collapsible: boolean
    collapsed: boolean
    /** A pane around this one is folded, so nothing in it shows. */
    hidden: boolean
    toggle: () => void
    /** Tells the pane it has a header to carry its collapse button; returns the undo. */
    registerHeader: () => () => void
}

const PaneContext = createContext<PaneContextValue | undefined>(undefined)

/** Whether the pane, or one around it, is folded. */
const FoldedContext = createContext(false)

// Folded, a pane hides everything in it, however deeply wrapped, and takes it
// out of the tab order. Its collapse button's bar opts back in and fills it.
const FOLDED = 'relative [&>*]:invisible'
const RAIL = 'visible! absolute inset-0'

export interface PaneGroupProps extends GroupProps {
    /** The density of every pane inside that does not set its own. */
    density?: Density
}

/**
 * Docks panes side by side (`horizontal`, the default) or one above the other
 * (`vertical`), a hairline apart. Put a PaneHandle between two panes to let
 * the user resize them. A pane can hold another group, so layouts nest. It
 * fills its parent, which needs a height. Built on react-resizable-panels'
 * Group and takes its props, such as `defaultLayout` and `onLayoutChanged` to
 * remember a layout.
 */
export const PaneGroup = ({
    orientation = 'horizontal',
    density,
    className,
    ...props
}: PaneGroupProps) => (
    <PaneGroupContext.Provider value={orientation}>
        <Group
            {...props}
            orientation={orientation}
            data-slot="pane-group"
            data-density={density}
            className={cn(
                'h-full min-h-0 min-w-0',
                density && DENSITY[density],
                className
            )}
        />
    </PaneGroupContext.Provider>
)

const SURFACE =
    'flex min-h-0 min-w-0 flex-col bg-dhis2-background font-dhis2 text-(length:--dhis2-text) text-dhis2-foreground'

// The hairline between panes belongs to every pane but a group's first.
const SEPARATED = {
    horizontal:
        'border-dhis2-border-strong [[data-panel]:not(:first-child)>&]:border-s',
    vertical:
        'border-dhis2-border-strong [[data-panel]:not(:first-child)>&]:border-t',
}

export interface PaneProps extends Omit<PanelProps, 'panelRef'> {
    /** The density of everything inside; inherited when left out. */
    density?: Density
    /**
     * The side of its group the pane is docked to: `start` is the left or the
     * top, `end` the right or the bottom. It sets which way the collapse
     * button points and which end of the header it sits at.
     */
    side?: Side
    onCollapsedChange?: (collapsed: boolean) => void
}

/**
 * A docked region, and the only parent a block should have. Put a PaneHeader
 * and a Toolbar at its top and the rest in a PaneContent, which scrolls.
 *
 * In a PaneGroup it is a react-resizable-panels Panel and takes its props. A
 * number for `defaultSize`, `minSize` or `maxSize` is in pixels, and a pane
 * with a `defaultSize` in pixels (a number, or a string ending in `px`) keeps
 * it when the group resizes. `collapsible`
 * gives its PaneHeader a button that folds it to `collapsedSize`; dragging it
 * below `minSize` folds it too. Name it with `aria-label` or `aria-labelledby`.
 */
export const Pane = ({
    density,
    side = 'start',
    collapsible = false,
    collapsedSize = 40,
    minSize = collapsible ? 160 : undefined,
    onCollapsedChange,
    onResize,
    className,
    style,
    children,
    ...props
}: PaneProps) => {
    const orientation = useContext(PaneGroupContext)
    const hidden = useContext(FoldedContext)
    const panelRef = usePanelRef()
    const [collapsed, setCollapsed] = useState(false)
    const [headers, setHeaders] = useState(0)
    const registerHeader = useCallback(() => {
        setHeaders((count) => count + 1)
        return () => setHeaders((count) => count - 1)
    }, [])
    const context = useMemo(
        () =>
            orientation && {
                orientation,
                side,
                collapsible,
                collapsed,
                hidden,
                toggle: () => {
                    if (panelRef.current?.isCollapsed()) {
                        panelRef.current.expand()
                    } else panelRef.current?.collapse()
                },
                registerHeader,
            },
        [
            orientation,
            side,
            collapsible,
            collapsed,
            hidden,
            panelRef,
            registerHeader,
        ]
    )
    const surface = cn(
        SURFACE,
        // Docked, panes share hairlines; on its own, a pane has an edge.
        orientation
            ? cn('h-full', SEPARATED[orientation])
            : 'border border-dhis2-border-strong',
        collapsed && FOLDED,
        density && DENSITY[density],
        className
    )
    // A pane's own content is not laid out by the group around the pane.
    const content = (
        <PaneGroupContext.Provider value={undefined}>
            <PaneContext.Provider value={context}>
                <FoldedContext.Provider value={hidden || collapsed}>
                    {children}
                </FoldedContext.Provider>
                {/* Dragged shut with no header to open it from, it gets a button of its own. */}
                {context && collapsed && headers === 0 && (
                    <div
                        className={cn(
                            'flex items-start justify-center pt-(--dhis2-pane-pad)',
                            !hidden && RAIL
                        )}
                    >
                        <CollapseButton
                            pane={context}
                            label={props['aria-label']}
                            labelledBy={props['aria-labelledby']}
                        />
                    </div>
                )}
            </PaneContext.Provider>
        </PaneGroupContext.Provider>
    )
    const labelled =
        props['aria-label'] !== undefined ||
        props['aria-labelledby'] !== undefined

    if (!orientation) {
        // Outside a group there is no panel to size, so its props are dropped.
        const {
            defaultSize: _defaultSize,
            maxSize: _maxSize,
            collapsedThreshold: _collapsedThreshold,
            disabled: _disabled,
            elementRef: _elementRef,
            groupResizeBehavior: _groupResizeBehavior,
            id,
            ...attributes
        } = props
        return (
            <section
                {...attributes}
                style={style}
                id={id === undefined ? undefined : String(id)}
                data-slot="pane"
                data-density={density}
                className={surface}
            >
                {content}
            </section>
        )
    }
    return (
        <Panel
            // A pane sized in pixels keeps that size when the group resizes.
            groupResizeBehavior={
                Number.isFinite(props.defaultSize) ||
                String(props.defaultSize).endsWith('px')
                    ? 'preserve-pixel-size'
                    : undefined
            }
            role={labelled ? 'region' : undefined}
            {...props}
            panelRef={panelRef}
            collapsible={collapsible}
            collapsedSize={collapsedSize}
            minSize={minSize}
            data-slot="pane"
            data-density={density}
            data-collapsed={collapsed ? '' : undefined}
            className={surface}
            // The panel scrolls by default; here only PaneContent does.
            style={{ overflow: 'hidden', ...style }}
            onResize={(size, id, previous) => {
                onResize?.(size, id, previous)
                const next = panelRef.current?.isCollapsed() ?? false
                if (next === collapsed) return
                setCollapsed(next)
                onCollapsedChange?.(next)
            }}
        >
            {content}
        </Panel>
    )
}

/**
 * The splitter between two panes of a PaneGroup: drag it, or focus it and use
 * the arrow keys. It draws nothing until it is hovered, focused or dragged.
 * A react-resizable-panels Separator; name it with `aria-label`.
 */
export const PaneHandle = ({ className, ...props }: SeparatorProps) => (
    <Separator
        {...props}
        data-slot="pane-handle"
        className={cn(
            'relative z-20 basis-0 outline-none focus-visible:outline-3 focus-visible:outline-dhis2-ring focus-visible:outline-solid after:absolute hover:after:bg-dhis2-border-strong focus-visible:after:bg-dhis2-ring aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:-inset-y-0.5 aria-[orientation=vertical]:after:-inset-x-0.5 aria-[orientation=vertical]:after:inset-y-0 data-[separator=active]:after:bg-dhis2-ring',
            className
        )}
    />
)

/** The scrolling part of a pane, under its header and toolbar. */
export const PaneContent = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) => (
    <div
        {...props}
        data-slot="pane-content"
        className={cn('min-h-0 flex-1 overflow-auto', className)}
    />
)

/**
 * The collapse button's icon: a panel with the side the pane sits on marked
 * off. Lucide's panel-left, panel-right, panel-top and panel-bottom (ISC
 * License, Copyright (c) Lucide Contributors).
 */
const PANEL_LINE = {
    horizontal: { start: 'M9 3v18', end: 'M15 3v18' },
    vertical: { start: 'M3 9h18', end: 'M3 15h18' },
}

const CollapseButton = ({
    pane,
    label,
    labelledBy,
}: {
    pane: PaneContextValue
    label?: string
    labelledBy?: string
}) => (
    <button
        type="button"
        data-slot="pane-toggle"
        aria-expanded={!pane.collapsed}
        aria-label={label}
        aria-labelledby={labelledBy}
        className="flex size-(--dhis2-control-h-sm) shrink-0 cursor-pointer items-center justify-center rounded-dhis2-sm border-0 bg-transparent p-0 text-dhis2-muted-foreground outline-none hover:bg-dhis2-accent focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring focus-visible:outline-solid"
        onClick={pane.toggle}
    >
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-4 rtl:-scale-x-100"
        >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d={PANEL_LINE[pane.orientation][pane.side]} />
        </svg>
    </button>
)

export interface PaneHeaderProps extends Omit<
    ComponentPropsWithoutRef<'header'>,
    'title'
> {
    title: ReactNode
    /** Trailing actions. */
    children?: ReactNode
}

/**
 * A pane's small title, with optional trailing actions. In a collapsible pane
 * it carries the collapse button, at the end that faces the other panes.
 */
export const PaneHeader = ({
    title,
    className,
    children,
    ...props
}: PaneHeaderProps) => {
    const pane = useContext(PaneContext)
    const titleId = useId()
    const registerHeader = pane?.registerHeader
    useEffect(() => registerHeader?.(), [registerHeader])
    const collapsed = pane?.collapsed ?? false
    // Folded sideways, a pane is a rail with room for the button only.
    const rail = collapsed && pane?.orientation === 'horizontal'
    const toggle = pane?.collapsible && (
        <CollapseButton pane={pane} labelledBy={titleId} />
    )
    return (
        <header
            {...props}
            data-slot="pane-header"
            className={cn(
                'flex shrink-0 items-center gap-(--dhis2-gap) border-dhis2-border-strong bg-dhis2-background',
                // Folded, the header fills what is left of the pane.
                collapsed
                    ? cn(
                          'justify-center overflow-hidden',
                          !pane?.hidden && RAIL
                      )
                    : cn(BAR_HEIGHT, 'border-b'),
                rail
                    ? 'items-start pt-(--dhis2-pane-pad)'
                    : 'px-(--dhis2-pane-pad)',
                className
            )}
        >
            {pane?.side === 'end' && toggle}
            <h2
                id={titleId}
                className={cn(
                    'm-0 min-w-0 flex-1 truncate text-(length:--dhis2-text-xs) font-semibold text-dhis2-muted-foreground',
                    rail && 'hidden'
                )}
            >
                {title}
            </h2>
            {children !== undefined && !collapsed && (
                <div className="flex shrink-0 items-center">{children}</div>
            )}
            {pane?.side !== 'end' && toggle}
        </header>
    )
}
