import { Button } from '@dhis2/ui'
import { IconLayoutColumns16 } from '@dhis2/ui-icons'
import React, { type ReactNode, useState } from 'react'
import type { WorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { ProgramFieldCatalog } from '../../api/metadata'
import type { TrackerProgram } from '../../api/schemas'
import type {
    AppliedFilter,
    WorkingListConfiguration,
    WorkingListCriteria,
    WorkingListField,
    WorkingListViewConfiguration,
} from '../../domain/model'
import type { FilterSerializationContext } from '../../registry/valueTypes'
import { ColumnSettingsDialog } from '../ColumnSettingsDialog'
import {
    fieldDisplayName,
    FilterButton,
    type FilterCalendarContext,
    MoreFilters,
    ProgramStageControl,
} from '../FilterControls'
import accessibilityStyles from '../styles/accessibility.module.css'
import { useWorkingListText } from '../WorkingListText'
import styles from './WorkingList.module.css'

const visibleFiltersForConfiguration = (
    configuration: WorkingListConfiguration
) => {
    const tracker: string[] = []
    const event: string[] = []
    for (const filter of configuration.filters) {
        const ids = filter.field.scope === 'event' ? event : tracker
        if (!ids.includes(filter.field.id)) {
            ids.push(filter.field.id)
        }
    }
    return { tracker, event }
}

interface WorkingListFilterBarProps {
    client: WorkingListClient
    program: TrackerProgram
    metadata: ProgramFieldCatalog
    capabilities: WorkingListCapabilities
    configuration: WorkingListConfiguration
    criteria: WorkingListCriteria
    view: WorkingListViewConfiguration
    tableFields: WorkingListField[]
    validationContext: FilterSerializationContext
    calendarContext: FilterCalendarContext
    configureMenu: ReactNode
    onApplyFilter: (filter: AppliedFilter) => void
    onResetFilter: (fieldId: string) => void
    onEnterStage: (stageId?: string) => void
    onUpdateView: (view: WorkingListViewConfiguration) => void
}

export const WorkingListFilterBar = ({
    client,
    program,
    metadata,
    capabilities,
    configuration,
    criteria,
    view,
    tableFields,
    validationContext,
    calendarContext,
    configureMenu,
    onApplyFilter,
    onResetFilter,
    onEnterStage,
    onUpdateView,
}: WorkingListFilterBarProps) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }
    const initialVisible = visibleFiltersForConfiguration(configuration)
    const [visibleTrackerFilterIds, setVisibleTrackerFilterIds] = useState(
        initialVisible.tracker
    )
    const [visibleEventFilterIds, setVisibleEventFilterIds] = useState(
        initialVisible.event
    )
    const [autoOpenFilterId, setAutoOpenFilterId] = useState<string>()
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false)

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
    const clearAutoOpen = (fieldId: string) =>
        setAutoOpenFilterId((openId) =>
            openId === fieldId ? undefined : openId
        )

    return (
        <>
            <section
                className={styles['filter-actions-bar']}
                aria-labelledby="tracker-filters-heading"
            >
                <h2
                    id="tracker-filters-heading"
                    className={accessibilityStyles['visually-hidden']}
                >
                    {i18n.t('Tracked entity filters')}
                </h2>
                <div
                    className={styles['filters-and-columns']}
                    data-testid="filters-and-columns"
                >
                    <Button
                        secondary
                        small
                        icon={<IconLayoutColumns16 />}
                        dataTest="configure-columns"
                        onClick={() => setColumnSettingsOpen(true)}
                    >
                        {i18n.t('Columns')}
                    </Button>
                    <MoreFilters
                        scope="tracked-entity"
                        fields={trackerFilterFields}
                        visibleFilterIds={[
                            ...visibleTrackerFilterIds,
                            ...visibleEventFilterIds,
                        ]}
                        program={program}
                        selectedStageId={
                            criteria.mode === 'event'
                                ? criteria.programStageId
                                : undefined
                        }
                        eventFields={allEventFilterFields}
                        onAdd={(fieldId) => {
                            setVisibleTrackerFilterIds((ids) => [
                                ...ids,
                                fieldId,
                            ])
                            setAutoOpenFilterId(fieldId)
                        }}
                        onSelectStage={onEnterStage}
                        onAddStageFilter={(stageId, fieldId) => {
                            onEnterStage(stageId)
                            setVisibleEventFilterIds((ids) =>
                                ids.includes(fieldId) ? ids : [...ids, fieldId]
                            )
                            setAutoOpenFilterId(fieldId)
                        }}
                    />
                    <div className={styles['tracker-filter-controls']}>
                        {visibleTrackerFilterIds.map((fieldId) => {
                            const field = metadata.fields.get(fieldId)
                            if (!field?.filterable) {
                                return null
                            }
                            return (
                                <FilterButton
                                    key={field.id}
                                    client={client}
                                    field={field}
                                    filter={criteria.filters.find(
                                        (filter) => filter.field.id === field.id
                                    )}
                                    capabilities={capabilities}
                                    validationContext={validationContext}
                                    calendarContext={calendarContext}
                                    defaultOpen={autoOpenFilterId === field.id}
                                    onApply={onApplyFilter}
                                    onReset={() => onResetFilter(field.id)}
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
                    {criteria.mode === 'event' && (
                        <div
                            className={styles['stage-filter-controls']}
                            data-testid="stage-filter-section"
                        >
                            <ProgramStageControl
                                program={program}
                                selectedStageId={criteria.programStageId}
                                onChange={onEnterStage}
                                onRemove={() => onEnterStage(undefined)}
                            />
                            {visibleEventFilterIds.map((fieldId) => {
                                const field = metadata.fields.get(fieldId)
                                if (
                                    !field ||
                                    !eventFilterFields.includes(field)
                                ) {
                                    return null
                                }
                                return (
                                    <FilterButton
                                        key={field.id}
                                        client={client}
                                        field={field}
                                        prefix={`${currentStage?.displayName ?? ''} / ${fieldDisplayName(field, translate)}`}
                                        filter={criteria.filters.find(
                                            (filter) =>
                                                filter.field.id === field.id
                                        )}
                                        capabilities={capabilities}
                                        validationContext={validationContext}
                                        calendarContext={calendarContext}
                                        defaultOpen={
                                            autoOpenFilterId === field.id
                                        }
                                        onApply={onApplyFilter}
                                        onReset={() => onResetFilter(field.id)}
                                        onRemove={() => {
                                            clearAutoOpen(field.id)
                                            setVisibleEventFilterIds((ids) =>
                                                ids.filter(
                                                    (id) => id !== field.id
                                                )
                                            )
                                        }}
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>
                {configureMenu}
            </section>

            {columnSettingsOpen && (
                <ColumnSettingsDialog
                    fields={tableFields}
                    visibleColumnIds={view.columns}
                    onChange={(columns) => onUpdateView({ ...view, columns })}
                    onClose={() => setColumnSettingsOpen(false)}
                />
            )}
        </>
    )
}
