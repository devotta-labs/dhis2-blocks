import React, { useMemo } from 'react'
import { useStore } from 'zustand'
import { Card, CardHeader, CardTitle } from '@/registry/dhis2/ui/card'
import { cn } from '@/registry/dhis2/ui/cn'
import type { FieldModel } from '../model/buildFormModel'
import type { EventContext } from '../state/store'
import {
    useEventFormFieldContext,
    useEventFormInternal,
} from './EventForm/EventFormContext'
import {
    CONTEXT_FIELD_IDS,
    fromGeometry,
    isScheduled,
} from './EventForm/initialState'
import { useEventFormText } from './EventFormText'
import { CoordinateField } from './fields/CoordinateField'
import { DateField } from './fields/DateField'
import { OrgUnitField } from './fields/OrgUnitField'

interface ContextFieldArgs {
    id: string
    label: string
    kind: FieldModel['kind']
    value: string | undefined
    required: boolean
    showErrors: boolean
}

/** A context field in the shape the field widgets take. */
const contextField = ({
    id,
    label,
    kind,
    value,
    required,
    showErrors,
}: ContextFieldArgs): FieldModel => ({
    id,
    label,
    kind,
    ...(value !== undefined && { value }),
    disabled: false,
    required,
    requiredMissing: required && showErrors && value === undefined,
    hidden: false,
    messages: { ruleErrors: [] },
    unsupported: false,
})

const useContextCommit = (field: keyof EventContext) => {
    const { commitContext } = useEventFormInternal('EventFormDetails')
    return useMemo(
        () => (value: string | undefined) => commitContext(field, value),
        [commitContext, field]
    )
}

/**
 * "About this event": the report date (labelled as the stage names it), the organisation unit
 * and, for stages that capture a point, the coordinate. They commit like answers do.
 */
export const EventFormDetails = ({ className }: { className?: string }) => {
    const translate = useEventFormText()
    const { store, stage } = useEventFormInternal('EventFormDetails')
    const { readOnly } = useEventFormFieldContext()
    const context = useStore(store, (state) => state.context)
    const status = useStore(store, (state) => state.status)
    const showErrors = useStore(store, (state) => state.attempt !== 'none')
    const commitDate = useContextCommit('occurredAt')
    const commitOrgUnit = useContextCommit('orgUnitId')
    const commitGeometry = useContextCommit('geometry')

    const dateLabel = stage.executionDateLabel ?? translate('Report date')
    const date = useMemo(
        () =>
            contextField({
                id: CONTEXT_FIELD_IDS.occurredAt,
                label: dateLabel,
                kind: 'date',
                value: context.occurredAt,
                required: !isScheduled(status),
                showErrors,
            }),
        [dateLabel, context.occurredAt, status, showErrors]
    )
    const orgUnitLabel = translate('Organisation unit')
    const orgUnit = useMemo(
        () =>
            contextField({
                id: CONTEXT_FIELD_IDS.orgUnitId,
                label: orgUnitLabel,
                kind: 'orgUnit',
                value: context.orgUnitId,
                required: true,
                showErrors,
            }),
        [orgUnitLabel, context.orgUnitId, showErrors]
    )
    const coordinateLabel = translate('Coordinate')
    const coordinateValue = fromGeometry(context.geometry)
    const coordinate = useMemo(
        () =>
            contextField({
                id: CONTEXT_FIELD_IDS.geometry,
                label: coordinateLabel,
                kind: 'coordinate',
                value: coordinateValue,
                required: false,
                showErrors,
            }),
        [coordinateLabel, coordinateValue, showErrors]
    )

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>
                    <h2 className="m-0 text-base leading-snug font-medium">
                        {translate('About this event')}
                    </h2>
                </CardTitle>
            </CardHeader>
            <div className={cn('flex flex-col gap-4 px-4')}>
                <DateField
                    field={date}
                    onCommit={commitDate}
                    disabled={readOnly}
                />
                <OrgUnitField
                    field={orgUnit}
                    onCommit={commitOrgUnit}
                    disabled={readOnly}
                />
                {stage.featureType === 'POINT' && (
                    <CoordinateField
                        field={coordinate}
                        onCommit={commitGeometry}
                        disabled={readOnly}
                    />
                )}
            </div>
        </Card>
    )
}
