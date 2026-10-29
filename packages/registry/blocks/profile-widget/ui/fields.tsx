import i18n from '@dhis2/d2-i18n'
import React, {
    forwardRef,
    useId,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/dhis2/ui/tooltip'
import type { ProfileFieldValue } from '../types'

export const ProfileWidgetFieldList = forwardRef<
    HTMLDListElement,
    ComponentPropsWithoutRef<'dl'>
>(({ className, ...props }, ref) => (
    <dl
        {...props}
        ref={ref}
        data-slot="profile-widget-field-list"
        className={cn('m-0 p-0', className)}
    />
))
ProfileWidgetFieldList.displayName = 'ProfileWidgetFieldList'

export type ProfileWidgetFieldProps = Omit<
    ComponentPropsWithoutRef<'div'>,
    'children'
> & {
    label: ReactNode
    children?: ReactNode
}

const cellClassName = 'min-w-0 overflow-hidden wrap-break-word hyphens-auto'

export const ProfileWidgetField = forwardRef<
    HTMLDivElement,
    ProfileWidgetFieldProps
>(({ label, children, className, ...props }, ref) => (
    <div
        {...props}
        ref={ref}
        data-slot="profile-widget-field"
        className={cn(
            'flex border-b border-dhis2-grey-300 py-2 text-sm leading-[19px] last:border-b-0',
            className
        )}
    >
        <dt
            data-slot="profile-widget-field-label"
            className={cn(
                cellClassName,
                'me-2 w-[110px] flex-none text-[13px] leading-[17px] text-dhis2-grey-700'
            )}
        >
            {label}
            <span aria-hidden="true">:</span>
        </dt>
        <dd
            data-slot="profile-widget-field-value"
            className={cn(cellClassName, 'm-0 flex-1 text-dhis2-grey-900')}
        >
            {children}
        </dd>
    </div>
))
ProfileWidgetField.displayName = 'ProfileWidgetField'

export interface ProfileWidgetValueProps {
    value: ProfileFieldValue
    className?: string
}

const linkClassName =
    'text-dhis2-blue-600 underline hover:text-dhis2-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dhis2-ring'

function OrganisationUnitValue({
    name,
    path,
    className,
    ...props
}: {
    name: string
    path: readonly string[]
    className?: string
    'data-slot': string
    'data-kind': string
}) {
    const pathId = useId()

    if (path.length === 0) {
        return (
            <span {...props} className={className}>
                {name}
            </span>
        )
    }

    const fullPath = [...path, name].join(' / ')

    return (
        <Tooltip>
            <TooltipTrigger
                delay={600}
                render={
                    <span
                        {...props}
                        tabIndex={0}
                        aria-describedby={pathId}
                        className={cn(
                            'underline decoration-dotted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dhis2-ring',
                            className
                        )}
                    />
                }
            >
                {name}
            </TooltipTrigger>
            <span id={pathId} hidden>
                {fullPath}
            </span>
            <TooltipContent className="max-w-[900px]">
                {fullPath}
            </TooltipContent>
        </Tooltip>
    )
}

const formatCoordinate = (coordinate: number) => coordinate.toFixed(6)

export function ProfileWidgetValue({
    value,
    className,
}: ProfileWidgetValueProps) {
    const valueProps = {
        'data-slot': 'profile-widget-value',
        'data-kind': value.kind,
    }

    switch (value.kind) {
        case 'empty':
            return null
        case 'text':
            return (
                <span {...valueProps} className={className}>
                    {value.text}
                </span>
            )
        case 'file':
            return (
                <a
                    {...valueProps}
                    href={value.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(linkClassName, className)}
                >
                    {value.name || i18n.t('File')}
                </a>
            )
        case 'image':
            return (
                <a
                    {...valueProps}
                    href={value.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        'inline-flex h-20 max-w-[120px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dhis2-ring',
                        className
                    )}
                >
                    <img
                        src={value.previewHref}
                        alt={value.alt}
                        className="h-20 max-w-[120px] object-contain transition-opacity hover:opacity-50 motion-reduce:transition-none"
                    />
                </a>
            )
        case 'organisationUnit':
            return (
                <OrganisationUnitValue
                    {...valueProps}
                    name={value.name}
                    path={value.path}
                    className={className}
                />
            )
        case 'coordinate':
            return (
                <span {...valueProps} className={className}>
                    {i18n.t('Lat')}: {formatCoordinate(value.latitude)}
                    <br />
                    {i18n.t('Long')}: {formatCoordinate(value.longitude)}
                </span>
            )
        case 'polygon':
            return (
                <span {...valueProps} className={className}>
                    {i18n.t('Polygon')}
                </span>
            )
    }
}
