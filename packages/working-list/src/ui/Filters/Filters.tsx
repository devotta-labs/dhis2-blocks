import { Button } from '@dhis2/ui'
import { IconFilter16 } from '@dhis2/ui-icons'
import { Result } from 'better-result'
import React, { useState, type ComponentPropsWithoutRef } from 'react'
import type { AppliedFilter as ResolvedAppliedFilter } from '../../domain/model'
import type { WorkingListField } from '../../domain/model'
import {
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from '../../provider/WorkingListContext'
import { useWorkingListPrivateUi } from '../../provider/WorkingListPrivateContext'
import type {
    AppliedFilter,
    WorkingListConfiguration,
} from '../../provider/contracts'
import {
    fieldDisplayName,
    FilterButton,
    MoreFilters,
    ProgramStageControl,
} from '../FilterControls'
import { useWorkingListText } from '../WorkingListText'

export const visibleFiltersForConfiguration = (
    configuration: WorkingListConfiguration,
    fields: ReadonlyMap<string, WorkingListField>
) => {
    const tracker: string[] = []
    const event: string[] = []
    for (const filter of configuration.filters) {
        const field = fields.get(filter.fieldId)
        if (!field) {
            continue
        }
        const ids = field.scope === 'event' ? event : tracker
        if (!ids.includes(filter.fieldId)) {
            ids.push(filter.fieldId)
        }
    }
    return { tracker, event }
}

export const visibleEventFiltersAfterStageChange = ({
    configuration,
    stageId,
    visibleFilterIds,
    addedFilterId,
}: {
    configuration: WorkingListConfiguration
    stageId?: string
    visibleFilterIds: string[]
    addedFilterId?: string
}) => {
    const stageChanged =
        Boolean(stageId) &&
        (configuration.mode !== 'event' ||
            configuration.programStageId !== stageId)
    const nextIds = stageChanged ? [] : visibleFilterIds
    return addedFilterId && !nextIds.includes(addedFilterId)
        ? [...nextIds, addedFilterId]
        : nextIds
}

const withAppliedFilterIds = (
    visibleIds: string[],
    configuration: WorkingListConfiguration,
    fields: ReadonlyMap<string, WorkingListField>,
    scope: WorkingListField['scope']
) => {
    const ids = [...visibleIds]
    for (const filter of configuration.filters) {
        if (
            fields.get(filter.fieldId)?.scope === scope &&
            !ids.includes(filter.fieldId)
        ) {
            ids.push(filter.fieldId)
        }
    }
    return ids
}

const FiltersControl = () => {
    const translate = useWorkingListText()
    const configuration = useWorkingListState((state) => state.configuration)
    const actions = useWorkingListActions()
    const {
        client,
        program,
        metadata,
        capabilities,
        calendarContext,
        serializationContext,
        mutationBusy,
    } = useWorkingListPrivateUi()

    if (!program || !metadata || !calendarContext) {
        throw new Error(
            'WorkingListFilterControls requires resolved program metadata.'
        )
    }

    const initialVisible = visibleFiltersForConfiguration(
        configuration,
        metadata.fields
    )
    const [visibleTrackerFilterIds, setVisibleTrackerFilterIds] = useState(
        initialVisible.tracker
    )
    const [visibleEventFilterIds, setVisibleEventFilterIds] = useState(
        initialVisible.event
    )
    const [autoOpenFilterId, setAutoOpenFilterId] = useState<string>()

    const fields = [...metadata.fields.values()]
    const trackerFilterFields = fields.filter(
        (field) => field.scope === 'trackedEntity' && field.filterable
    )
    const allEventFilterFields = fields.filter(
        (field) =>
            field.scope === 'event' &&
            field.id !== 'programStage' &&
            field.filterable
    )
    const currentStage =
        configuration.mode === 'event'
            ? program.programStages.find(
                  (stage) => stage.id === configuration.programStageId
              )
            : undefined
    const stageFieldIds = new Set(
        currentStage?.programStageDataElements.map(
            (binding) => binding.dataElement.id
        ) ?? []
    )
    const eventFilterFields = allEventFilterFields.filter(
        (field) =>
            field.source !== 'eventDataElement' || stageFieldIds.has(field.id)
    )
    const trackerChipIds = withAppliedFilterIds(
        visibleTrackerFilterIds,
        configuration,
        metadata.fields,
        'trackedEntity'
    )
    const eventChipIds = withAppliedFilterIds(
        visibleEventFilterIds,
        configuration,
        metadata.fields,
        'event'
    )

    const compactFilter = (filter: ResolvedAppliedFilter): AppliedFilter => ({
        fieldId: filter.field.id,
        operator: filter.operator,
        value: filter.value,
    })
    const resolvedFilter = (field: WorkingListField) => {
        const filter = configuration.filters.find(
            (candidate) => candidate.fieldId === field.id
        )
        return filter ? { ...filter, field } : undefined
    }
    const applyFilter = (filter: ResolvedAppliedFilter) => {
        const result = actions.setFilter(compactFilter(filter))
        if (Result.isError(result)) {
            throw result.error
        }
    }
    const resetFilter = (fieldId: string) => {
        const result = actions.removeFilter(fieldId)
        if (Result.isError(result)) {
            throw result.error
        }
    }
    const enterStage = (stageId?: string, addedFilterId?: string) => {
        const result = actions.setProgramStage(stageId)
        if (Result.isError(result)) {
            throw result.error
        }
        setVisibleEventFilterIds((visibleFilterIds) =>
            visibleEventFiltersAfterStageChange({
                configuration,
                stageId,
                visibleFilterIds,
                addedFilterId,
            })
        )
    }
    const clearAutoOpen = (fieldId: string) =>
        setAutoOpenFilterId((openId) =>
            openId === fieldId ? undefined : openId
        )

    return (
        <>
            <MoreFilters
                scope="tracked-entity"
                fields={trackerFilterFields}
                visibleFilterIds={[...trackerChipIds, ...eventChipIds]}
                program={program}
                selectedStageId={
                    configuration.mode === 'event'
                        ? configuration.programStageId
                        : undefined
                }
                eventFields={allEventFilterFields}
                disabled={mutationBusy}
                onAdd={(fieldId) => {
                    setVisibleTrackerFilterIds((ids) => [...ids, fieldId])
                    setAutoOpenFilterId(fieldId)
                }}
                onSelectStage={enterStage}
                onAddStageFilter={(stageId, fieldId) => {
                    enterStage(stageId, fieldId)
                    setAutoOpenFilterId(fieldId)
                }}
            />
            <div className="contents">
                {trackerChipIds.map((fieldId) => {
                    const field = metadata.fields.get(fieldId)
                    if (!field?.filterable) {
                        return null
                    }
                    return (
                        <FilterButton
                            key={field.id}
                            client={client}
                            field={field}
                            filter={resolvedFilter(field)}
                            capabilities={capabilities}
                            validationContext={serializationContext}
                            calendarContext={calendarContext}
                            defaultOpen={autoOpenFilterId === field.id}
                            disabled={mutationBusy}
                            onApply={applyFilter}
                            onReset={() => resetFilter(field.id)}
                            onRemove={() => {
                                clearAutoOpen(field.id)
                                setVisibleTrackerFilterIds((ids) =>
                                    ids.filter((id) => id !== field.id)
                                )
                            }}
                        />
                    )
                })}
            </div>
            {configuration.mode === 'event' && (
                <div className="contents" data-testid="stage-filter-section">
                    <ProgramStageControl
                        program={program}
                        selectedStageId={configuration.programStageId}
                        disabled={mutationBusy}
                        onChange={enterStage}
                        onRemove={() => enterStage(undefined)}
                    />
                    {eventChipIds.map((fieldId) => {
                        const field = metadata.fields.get(fieldId)
                        if (!field || !eventFilterFields.includes(field)) {
                            return null
                        }
                        return (
                            <FilterButton
                                key={field.id}
                                client={client}
                                field={field}
                                prefix={`${currentStage?.displayName ?? ''} / ${fieldDisplayName(field, translate)}`}
                                filter={resolvedFilter(field)}
                                capabilities={capabilities}
                                validationContext={serializationContext}
                                calendarContext={calendarContext}
                                defaultOpen={autoOpenFilterId === field.id}
                                disabled={mutationBusy}
                                onApply={applyFilter}
                                onReset={() => resetFilter(field.id)}
                                onRemove={() => {
                                    clearAutoOpen(field.id)
                                    setVisibleEventFilterIds((ids) =>
                                        ids.filter((id) => id !== field.id)
                                    )
                                }}
                            />
                        )
                    })}
                </div>
            )}
        </>
    )
}

export interface WorkingListFilterControlsProps extends Omit<
    ComponentPropsWithoutRef<'div'>,
    'children'
> {}

export const WorkingListFilterControls = ({
    className,
    ...props
}: WorkingListFilterControlsProps) => {
    const translate = useWorkingListText()
    const ready = useWorkingListMeta(
        (meta) => meta.activeConfiguration.status === 'ready'
    )

    return (
        <div
            {...props}
            className={`flex min-w-0 flex-[1_1_0%] flex-wrap items-center gap-1${className ? ` ${className}` : ''}`}
            data-testid="working-list-filters"
        >
            {ready ? (
                <FiltersControl />
            ) : (
                <Button
                    secondary
                    small
                    icon={<IconFilter16 />}
                    dataTest="more-filters-tracked-entity"
                    disabled
                >
                    {translate('Filter')}
                </Button>
            )}
        </div>
    )
}
