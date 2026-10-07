import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { resolveWorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { TrackerProgram } from '../../api/schemas'
import type { WorkingListField } from '../../domain/model'
import {
    FilterButton,
    MoreFilters,
    ProgramStageControl,
} from '../FilterControls'
import { WorkingListTextProvider } from '../WorkingListText'

const field: WorkingListField = {
    id: 'followUp',
    displayName: 'Follow up',
    source: 'system',
    scope: 'trackedEntity',
    valueType: 'BOOLEAN',
    filterable: true,
}

const unusedClient: WorkingListClient = {
    query: () => Promise.reject(new Error('Unexpected query in focus test')),
    mutate: () =>
        Promise.reject(new Error('Unexpected mutation in focus test')),
}

describe('MoreFilters keyboard focus', () => {
    it('selects a stage row before adding a prefixed stage data-element filter', () => {
        const actEnvironment = globalThis
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        vi.useFakeTimers()
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        const onAddStageFilter = vi.fn()

        const eventField: WorkingListField = {
            id: 'DataElement01',
            displayName: 'Result',
            source: 'eventDataElement',
            scope: 'event',
            valueType: 'TEXT',
            filterable: true,
        }

        const program: TrackerProgram = {
            id: 'Program0001',
            displayName: 'Program',
            programType: 'WITH_REGISTRATION',
            programTrackedEntityAttributes: [],
            programStages: [
                {
                    id: 'Stage000001',
                    displayName: 'Visit',
                    programStageDataElements: [
                        { dataElement: { ...eventField } },
                    ],
                },
                {
                    id: 'Stage000002',
                    displayName: 'Follow-up',
                    programStageDataElements: [],
                },
            ],
        }

        const StageFilterHarness = () => {
            const [selectedStageId, setSelectedStageId] =
                React.useState<string>()

            const [selectedEventField, setSelectedEventField] =
                React.useState<WorkingListField>()

            const selectedStage = program.programStages.find(
                (stage) => stage.id === selectedStageId
            )

            return (
                <>
                    <MoreFilters
                        fields={[field]}
                        visibleFilterIds={
                            selectedEventField ? [selectedEventField.id] : []
                        }
                        scope="tracked-entity"
                        program={program}
                        selectedStageId={selectedStageId}
                        eventFields={[eventField]}
                        onAdd={() => undefined}
                        onSelectStage={setSelectedStageId}
                        onAddStageFilter={(stageId, fieldId) => {
                            onAddStageFilter(stageId, fieldId)
                            setSelectedEventField(eventField)
                        }}
                    />
                    {selectedStageId && (
                        <ProgramStageControl
                            program={program}
                            selectedStageId={selectedStageId}
                            onChange={setSelectedStageId}
                            onRemove={() => setSelectedStageId(undefined)}
                        />
                    )}
                    {selectedStage && selectedEventField && (
                        <FilterButton
                            client={unusedClient}
                            field={selectedEventField}
                            prefix={`${selectedStage.displayName} / ${selectedEventField.displayName}`}
                            capabilities={resolveWorkingListCapabilities({
                                apiVersion: 43,
                            })}
                            calendarContext={{
                                calendar: 'gregorian',
                                dateFormat: 'YYYY-MM-DD',
                                locale: 'en',
                                timeZone: 'Etc/UTC',
                            }}
                            onApply={() => undefined}
                            onReset={() => undefined}
                        />
                    )}
                </>
            )
        }

        try {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={(message) => message}>
                        <StageFilterHarness />
                    </WorkingListTextProvider>
                )
            })
            act(() => {
                container
                    .querySelector<HTMLButtonElement>(
                        '[data-testid="more-filters-tracked-entity"]'
                    )
                    ?.click()
            })
            act(() => {
                document
                    .querySelector<HTMLElement>(
                        '[data-test="program-stage-filter-menu"] [role="menuitem"]'
                    )
                    ?.dispatchEvent(
                        new MouseEvent('mouseover', { bubbles: true })
                    )
            })
            expect(
                document.querySelector(
                    '[data-test="select-filter-stage-Stage000001"]'
                )
            ).not.toBeNull()
            act(() => {
                document
                    .querySelector<HTMLElement>(
                        '[data-test="select-filter-stage-Stage000001"] [role="menuitem"]'
                    )
                    ?.click()
            })

            const trigger = container.querySelector<HTMLButtonElement>(
                '[data-testid="more-filters-tracked-entity"]'
            )

            expect(trigger?.getAttribute('aria-expanded')).toBe('false')
            expect(
                container.querySelector('[data-testid="filter-programStage"]')
                    ?.textContent
            ).toContain('Visit')
            expect(
                container.querySelector(
                    '[data-test="filter-programStage-select"] [tabindex]'
                )?.className
            ).toContain('dense')

            act(() => trigger?.click())

            const topLevelMenu = document.querySelector(
                '[data-test="more-filters-menu-tracked-entity"]'
            )

            expect(
                [...(topLevelMenu?.children ?? [])].flatMap((item) => {
                    const dataTest = item.getAttribute('data-test')

                    return dataTest ? [dataTest] : []
                })
            ).toEqual([
                'program-stage-filter-menu',
                'stage-filter-fields-Stage000001',
                'filter-scope-divider',
                'add-filter-followUp',
            ])
            act(() => {
                document
                    .querySelector<HTMLElement>(
                        '[data-test="program-stage-filter-menu"] [role="menuitem"]'
                    )
                    ?.dispatchEvent(
                        new MouseEvent('mouseover', { bubbles: true })
                    )
            })

            const lockedStage = document.querySelector<HTMLElement>(
                '[data-test="select-filter-stage-Stage000002"] [role="menuitem"]'
            )

            const selectedStageItem = document.querySelector<HTMLElement>(
                '[data-test="select-filter-stage-Stage000001"] [role="menuitem"]'
            )

            for (const [stageName, stageItem] of [
                ['Visit', selectedStageItem],
                ['Follow-up', lockedStage],
            ] as const) {
                expect(stageItem?.getAttribute('aria-disabled')).toBe('true')
                expect(stageItem?.getAttribute('aria-label')).toBe(stageName)
                expect(
                    stageItem
                        ?.closest('[role="presentation"]')
                        ?.querySelector(
                            '[tabindex="0"][aria-label*="Can only filter using one program stage."]'
                        )
                ).not.toBeNull()
            }

            const selectedStageTooltip = selectedStageItem
                ?.closest('[role="presentation"]')
                ?.querySelector<HTMLElement>(
                    '[tabindex="0"][aria-label*="Can only filter using one program stage."]'
                )

            act(() => {
                selectedStageTooltip?.dispatchEvent(
                    new MouseEvent('mouseover', { bubbles: true })
                )
                vi.advanceTimersByTime(201)
            })
            expect(
                document.querySelector(
                    '[data-test="stage-lock-tooltip-Stage000001-content"]'
                )?.textContent
            ).toBe('Can only filter using one program stage.')

            act(() => {
                document
                    .querySelector<HTMLElement>(
                        '[data-test="stage-filter-fields-Stage000001"] [role="menuitem"]'
                    )
                    ?.dispatchEvent(
                        new MouseEvent('mouseover', { bubbles: true })
                    )
            })
            expect(
                document.querySelector(
                    '[data-test="add-stage-filter-Stage000001-DataElement01"]'
                )
            ).not.toBeNull()
            act(() => {
                document
                    .querySelector<HTMLElement>(
                        '[data-test="add-stage-filter-Stage000001-DataElement01"] [role="menuitem"]'
                    )
                    ?.click()
            })
            expect(onAddStageFilter).toHaveBeenCalledWith(
                'Stage000001',
                'DataElement01'
            )
            expect(trigger?.getAttribute('aria-expanded')).toBe('false')
            expect(
                container.querySelector('[data-testid="filter-DataElement01"]')
                    ?.textContent
            ).toContain('Visit / Result:')

            const clearStage = container.querySelector<HTMLElement>(
                '[data-test="filter-programStage-select-clear"]'
            )

            expect(clearStage).not.toBeNull()
            act(() => {
                clearStage?.dispatchEvent(
                    new MouseEvent('mousedown', { bubbles: true })
                )
            })
            expect(
                container.querySelector('[data-testid="filter-programStage"]')
            ).toBeNull()
        } finally {
            act(() => root.unmount())
            container.remove()
            vi.useRealTimers()
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })
})
