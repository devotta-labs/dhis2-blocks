import i18n from '@dhis2/d2-i18n'
import { IconMore16 } from '@dhis2/ui-icons'
import React, {
    forwardRef,
    useId,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from 'react'
import { Button } from '@/components/dhis2/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/dhis2/ui/dropdown-menu'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/dhis2/ui/tooltip'

export type ProfileWidgetMenuProps = Omit<
    ComponentPropsWithoutRef<'button'>,
    'children'
> & {
    label?: string
    children: ReactNode
}

export const ProfileWidgetMenu = forwardRef<
    HTMLButtonElement,
    ProfileWidgetMenuProps
>(({ label = i18n.t('More actions'), children, className, ...props }, ref) => (
    <DropdownMenu>
        <DropdownMenuTrigger
            aria-label={label}
            title={label}
            {...props}
            ref={ref}
            data-slot="profile-widget-menu"
            render={
                <Button
                    variant="secondary"
                    size="icon-sm"
                    className={className}
                />
            }
        >
            <IconMore16 />
        </DropdownMenuTrigger>
        <DropdownMenuContent
            align="end"
            sideOffset={4}
            data-slot="profile-widget-menu-content"
        >
            {children}
        </DropdownMenuContent>
    </DropdownMenu>
))
ProfileWidgetMenu.displayName = 'ProfileWidgetMenu'

export type ProfileWidgetMenuItemProps = Omit<
    ComponentPropsWithoutRef<typeof DropdownMenuItem>,
    'variant'
> & {
    destructive?: boolean
    disabledReason?: string
}

export const ProfileWidgetMenuItem = forwardRef<
    HTMLElement,
    ProfileWidgetMenuItemProps
>(
    (
        {
            destructive = false,
            disabled = false,
            disabledReason,
            children,
            'aria-describedby': describedBy,
            ...props
        },
        ref
    ) => {
        const reasonId = useId()
        const variant = destructive && !disabled ? 'destructive' : 'default'

        if (!disabled || !disabledReason) {
            return (
                <DropdownMenuItem
                    {...props}
                    ref={ref}
                    aria-describedby={describedBy}
                    data-slot="profile-widget-menu-item"
                    data-destructive={destructive || undefined}
                    variant={variant}
                    disabled={disabled}
                >
                    {children}
                </DropdownMenuItem>
            )
        }

        return (
            <Tooltip>
                <TooltipTrigger
                    delay={200}
                    render={
                        <DropdownMenuItem
                            {...props}
                            ref={ref}
                            aria-describedby={[describedBy, reasonId]
                                .filter(Boolean)
                                .join(' ')}
                            data-slot="profile-widget-menu-item"
                            data-destructive={destructive || undefined}
                            variant={variant}
                            disabled
                        />
                    }
                >
                    {children}
                </TooltipTrigger>
                <span id={reasonId} hidden>
                    {disabledReason}
                </span>
                <TooltipContent data-slot="profile-widget-menu-item-reason">
                    {disabledReason}
                </TooltipContent>
            </Tooltip>
        )
    }
)
ProfileWidgetMenuItem.displayName = 'ProfileWidgetMenuItem'
