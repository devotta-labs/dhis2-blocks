import { Collapsible } from '@base-ui/react/collapsible'
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import i18n from '@dhis2/d2-i18n'
import { IconChevronDown24, IconChevronUp24 } from '@dhis2/ui-icons'
import React, {
    forwardRef,
    useEffect,
    useId,
    useState,
    type ComponentPropsWithoutRef,
} from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import type { ProfileWidgetProps } from '../types'
import { ProfileWidgetContext, useProfileWidget } from './context'

const toOpenState = (open: boolean) => (open ? 'open' : 'closed')

export const ProfileWidget = forwardRef<HTMLElement, ProfileWidgetProps>(
    (
        {
            open: controlledOpen,
            defaultOpen = true,
            onOpenChange,
            render,
            className,
            ...props
        },
        ref
    ) => {
        const [localOpen, setLocalOpen] = useState(defaultOpen)
        const [labelledBy, setLabelledBy] = useState<string | null>(null)
        const titleId = useId()
        const open = controlledOpen ?? localOpen
        const setOpen = (nextOpen: boolean) => {
            if (controlledOpen === undefined) {
                setLocalOpen(nextOpen)
            }

            onOpenChange?.(nextOpen)
        }
        const element = useRender({
            defaultTagName: 'section',
            ref,
            render,
            props: mergeProps<'section'>(
                {
                    'aria-labelledby': labelledBy ?? undefined,
                    className: cn(
                        'min-w-0 rounded-dhis2-sm border border-dhis2-grey-400 bg-white font-dhis2 text-dhis2-grey-900',
                        className
                    ),
                },
                props
            ),
            state: { slot: 'profile-widget', state: toOpenState(open) },
        })

        return (
            <ProfileWidgetContext.Provider
                value={{
                    state: { open },
                    meta: { titleId, labelledBy },
                    actions: { setLabelledBy },
                }}
            >
                <Collapsible.Root
                    open={open}
                    onOpenChange={setOpen}
                    render={element}
                />
            </ProfileWidgetContext.Provider>
        )
    }
)
ProfileWidget.displayName = 'ProfileWidget'

export const ProfileWidgetHeader = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
    <div
        {...props}
        ref={ref}
        data-slot="profile-widget-header"
        className={cn(
            'flex min-h-11 items-center justify-between gap-2 py-2 ps-3 pe-2 text-[15px] leading-5 font-medium text-dhis2-grey-800',
            className
        )}
    />
))
ProfileWidgetHeader.displayName = 'ProfileWidgetHeader'

export const ProfileWidgetTitle = forwardRef<
    HTMLHeadingElement,
    useRender.ComponentProps<'h2'>
>(({ render, className, id, ...props }, ref) => {
    const { meta, actions } = useProfileWidget()
    const titleId = id ?? meta.titleId
    const { setLabelledBy } = actions

    useEffect(() => {
        setLabelledBy(titleId)

        return () => setLabelledBy(null)
    }, [setLabelledBy, titleId])

    return useRender({
        defaultTagName: 'h2',
        ref,
        render,
        props: mergeProps<'h2'>(
            {
                id: titleId,
                className: cn(
                    'm-0 min-w-0 text-[15px] leading-5 font-medium wrap-break-word text-dhis2-grey-800',
                    className
                ),
            },
            props
        ),
        state: { slot: 'profile-widget-title' },
    })
})
ProfileWidgetTitle.displayName = 'ProfileWidgetTitle'

export const ProfileWidgetHeaderActions = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
    <div
        {...props}
        ref={ref}
        data-slot="profile-widget-header-actions"
        className={cn(
            'ms-auto flex shrink-0 items-center gap-1 font-normal',
            className
        )}
    />
))
ProfileWidgetHeaderActions.displayName = 'ProfileWidgetHeaderActions'

export type ProfileWidgetToggleProps = ComponentPropsWithoutRef<'button'> & {
    collapseLabel?: string
    expandLabel?: string
}

export const ProfileWidgetToggle = forwardRef<
    HTMLButtonElement,
    ProfileWidgetToggleProps
>(
    (
        { className, onClick, collapseLabel, expandLabel, children, ...props },
        ref
    ) => {
        const { state, meta } = useProfileWidget()
        const label = state.open
            ? (collapseLabel ?? i18n.t('Collapse'))
            : (expandLabel ?? i18n.t('Expand'))
        const hasNameOverride =
            collapseLabel !== undefined ||
            expandLabel !== undefined ||
            props['aria-label'] !== undefined ||
            props['aria-labelledby'] !== undefined
        const nameProps =
            !hasNameOverride && meta.labelledBy
                ? { 'aria-labelledby': meta.labelledBy }
                : { 'aria-label': label }

        return (
            <Collapsible.Trigger
                {...nameProps}
                title={label}
                {...props}
                ref={ref}
                data-slot="profile-widget-toggle"
                data-state={toOpenState(state.open)}
                className={cn(
                    'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-dhis2-sm border-0 bg-transparent p-0.5 text-dhis2-grey-600 hover:bg-dhis2-grey-200 hover:text-dhis2-grey-800 focus-visible:bg-dhis2-grey-200 focus-visible:text-dhis2-grey-800 focus-visible:outline-2 focus-visible:outline-dhis2-grey-800 disabled:cursor-not-allowed disabled:text-dhis2-grey-500 disabled:hover:bg-transparent [&_svg]:shrink-0 [&_svg]:fill-current',
                    className
                )}
                onClick={(event) => {
                    onClick?.(event)

                    if (event.defaultPrevented) {
                        event.preventBaseUIHandler()
                    }
                }}
            >
                {children ??
                    (state.open ? <IconChevronUp24 /> : <IconChevronDown24 />)}
            </Collapsible.Trigger>
        )
    }
)
ProfileWidgetToggle.displayName = 'ProfileWidgetToggle'

const contentClassName =
    'h-(--collapsible-panel-height) overflow-hidden px-3 pb-2 text-sm leading-[19px] transition-[height,padding-bottom] duration-200 ease-in-out data-ending-style:h-0 data-ending-style:pb-0 data-starting-style:h-0 data-starting-style:pb-0 motion-reduce:transition-none'

export type ProfileWidgetContentProps = Omit<
    Collapsible.Panel.Props,
    'className'
> & {
    className?: string
}

export const ProfileWidgetContent = forwardRef<
    HTMLDivElement,
    ProfileWidgetContentProps
>(({ className, ...props }, ref) => (
    <Collapsible.Panel
        {...props}
        ref={ref}
        data-slot="profile-widget-content"
        className={cn(contentClassName, className)}
    />
))
ProfileWidgetContent.displayName = 'ProfileWidgetContent'
