import i18n from '@dhis2/d2-i18n'
import { Button } from '@/components/dhis2/ui/button'
import { IconFilter16 } from '@dhis2/ui-icons'
import React, { useState, type ComponentPropsWithoutRef } from 'react'
import { fieldsForConfiguration } from '../../api/metadata'
import { visibleEventFiltersAfterStageChange } from '../../domain/visibleEventFilters'
import type { AppliedFilter as ResolvedAppliedFilter } from '../../domain/model'
import type { WorkingListField } from '../../domain/model'
import {
    withFilter,
    withoutFilter,
    withProgramStage,
} from '../../provider/configuration'
import { useIsSavingList } from '../../provider/mutations'
import {
    useWorkingListMetadata,
    useWorkingListView,
    type WorkingListMetadata,
    type WorkingListSelectedView,
} from '../../provider/queries'
import { useWorkingList } from '../../provider/WorkingListContext'
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

const visibleFiltersForConfiguration = (
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

const FiltersControl = ({
    metadata: {
        program,
        fieldCatalog,
        capabilities,
        calendarContext,
        serializationContext,
    },
    view: { configuration },
}: {
    metadata: WorkingListMetadata
    view: WorkingListSelectedView
}) => {
    const { setDraft } = useWorkingList()
    const mutationBusy = useIsSavingList()

    const activeFields = fieldsForConfiguration(fieldCatalog, configuration)

    const initialVisible = visibleFiltersForConfiguration(
        configuration,
        activeFields
    )
    const [visibleTrackerFilterIds, setVisibleTrackerFilterIds] = useState(
        initialVisible.tracker
    )
    const [visibleEventFilterIds, setVisibleEventFilterIds] = useState(
        initialVisible.event
    )
    const [autoOpenFilterId, setAutoOpenFilterId] = useState<string>()

    const fields = [...activeFields.values()]
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
        activeFields,
        'trackedEntity'
    )
    const eventChipIds = withAppliedFilterIds(
        visibleEventFilterIds,
        configuration,
        activeFields,
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
    const applyFilter = (filter: ResolvedAppliedFilter) =>
        setDraft(withFilter(configuration, compactFilter(filter)))
    const resetFilter = (fieldId: string) =>
        setDraft(withoutFilter(configuration, fieldId))
    const enterStage = (stageId?: string, addedFilterId?: string) => {
        setDraft(withProgramStage(configuration, fieldCatalog, stageId))
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
                    const field = activeFields.get(fieldId)
                    if (!field?.filterable) {
                        return null
                    }
                    return (
                        <FilterButton
                            key={field.id}
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
                        const field = activeFields.get(fieldId)
                        if (!field || !eventFilterFields.includes(field)) {
                            return null
                        }
                        return (
                            <FilterButton
                                key={field.id}
                                field={field}
                                prefix={`${currentStage?.displayName ?? ''} / ${fieldDisplayName(field)}`}
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
    const { viewId } = useWorkingList()
    const metadata = useWorkingListMetadata().data
    const view = useWorkingListView().data

    return (
        <div
            {...props}
            className={`flex min-w-0 flex-[1_1_0%] flex-wrap items-center gap-1${className ? ` ${className}` : ''}`}
            data-testid="working-list-filters"
        >
            {metadata && view ? (
                // Which filter chips show starts over with each view.
                <FiltersControl key={viewId} metadata={metadata} view={view} />
            ) : (
                <Button
                    variant="secondary"
                    size="field-dense"
                    data-test="more-filters-tracked-entity"
                    disabled
                >
                    <IconFilter16 />
                    {i18n.t('Filter')}
                </Button>
            )}
        </div>
    )
}
