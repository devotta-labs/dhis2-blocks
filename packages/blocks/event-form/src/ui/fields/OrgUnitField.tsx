import { useDataQuery } from '@dhis2/app-runtime'
import { OrganisationUnitTree } from '@dhis2/ui'
import React, { useEffect, useMemo, useState } from 'react'
import { cn } from '@/registry/dhis2/ui/cn'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/registry/dhis2/ui/popover'
import { selectTriggerVariants } from '@/registry/dhis2/ui/select'
import { Spinner } from '@/registry/dhis2/ui/spinner'
import { useEventFormFieldContext } from '../EventForm/EventFormContext'
import { useEventFormText } from '../EventFormText'
import { ClearValueButton } from './ClearValueButton'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

interface OrgUnitDetails {
    unit: {
        id: string
        displayName: string
        path: string
        ancestors: { displayName: string }[]
    }
}

const UNIT_QUERY = {
    unit: {
        resource: 'organisationUnits',
        id: (variables: { id?: string }) => String(variables.id),
        params: { fields: 'id,displayName,path,ancestors[displayName]' },
    },
}

/** The selected unit's name with its path above it. */
const SelectedUnit = ({
    id,
    unit,
    failed,
}: {
    id: string
    unit?: OrgUnitDetails['unit']
    failed: boolean
}) => {
    const translate = useEventFormText()
    if (failed) {
        return <span className="truncate">{id}</span>
    }
    if (unit === undefined) {
        return <Spinner aria-label={translate('Loading')} className="size-4" />
    }
    return (
        <span className="flex min-w-0 flex-col" data-unit={id}>
            <span
                data-testid="orgunit-path"
                className="truncate text-xs text-dhis2-grey-600"
            >
                {unit.ancestors
                    .map((ancestor) => ancestor.displayName)
                    .join(' / ')}
            </span>
            <span data-testid="orgunit-name" className="truncate">
                {unit.displayName}
            </span>
        </span>
    )
}

const ancestorPaths = (path: string): string[] => {
    const ids = path.split('/').filter((id) => id !== '')
    return ids
        .slice(0, -1)
        .map((_, index) => `/${ids.slice(0, index + 1).join('/')}`)
}

/** Picks an organisation unit from the tree under the user's roots and commits its uid. */
export const OrgUnitField = ({
    field,
    onCommit,
    disabled,
}: FieldWidgetProps) => {
    const translate = useEventFormText()
    const { orgUnitRoots } = useEventFormFieldContext()
    const [open, setOpen] = useState(false)
    const roots = useMemo(() => [...orgUnitRoots], [orgUnitRoots])
    const { data, error, refetch } = useDataQuery<OrgUnitDetails>(UNIT_QUERY, {
        lazy: true,
    })
    const value = field.value
    useEffect(() => {
        if (value !== undefined) {
            void refetch({ id: value })
        }
    }, [value, refetch])
    // The previous unit stays in `data` until the next one arrives.
    const unit =
        data !== undefined && data.unit.id === value ? data.unit : undefined
    return (
        <FieldShell field={field}>
            {(control) => (
                <div className="flex items-center gap-1">
                    <Popover open={open && !disabled} onOpenChange={setOpen}>
                        <PopoverTrigger
                            {...control}
                            role="combobox"
                            aria-expanded={open}
                            aria-haspopup="dialog"
                            disabled={disabled}
                            className={cn(
                                selectTriggerVariants({ size: 'default' }),
                                'h-auto max-w-80'
                            )}
                        >
                            {value === undefined ? (
                                <span className="text-dhis2-grey-600">
                                    {translate('Select an organisation unit')}
                                </span>
                            ) : (
                                <SelectedUnit
                                    id={value}
                                    unit={unit}
                                    failed={error !== undefined}
                                />
                            )}
                        </PopoverTrigger>
                        <PopoverContent
                            align="start"
                            className="max-h-80 w-80 max-w-[90vw] overflow-auto"
                        >
                            <OrganisationUnitTree
                                roots={roots}
                                singleSelection
                                selected={unit === undefined ? [] : [unit.path]}
                                initiallyExpanded={
                                    unit === undefined
                                        ? []
                                        : ancestorPaths(unit.path)
                                }
                                onChange={(unit) => {
                                    if (unit.checked) {
                                        onCommit(unit.id)
                                        setOpen(false)
                                    }
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                    {field.value !== undefined && (
                        <ClearValueButton
                            disabled={disabled}
                            onClear={() => onCommit(undefined)}
                        />
                    )}
                </div>
            )}
        </FieldShell>
    )
}
