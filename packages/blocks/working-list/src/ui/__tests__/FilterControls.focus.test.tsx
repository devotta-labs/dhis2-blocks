import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
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
    it('selects a stage row before adding a prefixed stage data-element filter', async () => {
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

        const screen = await render(
            <WorkingListTextProvider translate={(message) => message}>
                <StageFilterHarness />
            </WorkingListTextProvider>
        )
        const menuItem = (dataTest: string) =>
            page.elementLocator(
                document.querySelector<HTMLElement>(
                    `[data-test="${dataTest}"][role="menuitem"]`
                )!
            )
        const openSubmenu = async (dataTest: string) => {
            await expect
                .poll(() =>
                    document.querySelector(
                        `[data-test="${dataTest}"][role="menuitem"]`
                    )
                )
                .not.toBeNull()
            await menuItem(dataTest).click()
        }
        const trigger = screen.getByTestId('more-filters-tracked-entity')

        await trigger.click()
        await openSubmenu('program-stage-filter-menu')
        await openSubmenu('select-filter-stage-Stage000001')

        await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
        await expect
            .element(screen.getByTestId('filter-programStage'))
            .toHaveTextContent('Visit')
        expect(
            screen.container.querySelector(
                '[data-test="filter-programStage-select"] [tabindex]'
            )?.className
        ).toContain('dense')

        await trigger.click()
        const topLevelMenu = page.getByRole('menu')
        await expect.element(topLevelMenu).toBeVisible()
        expect(
            [...topLevelMenu.element().children]
                .map((item) => item.getAttribute('data-test'))
                .filter(Boolean)
        ).toEqual([
            'program-stage-filter-menu',
            'stage-filter-fields-Stage000001',
            'filter-scope-divider',
            'add-filter-followUp',
        ])

        await openSubmenu('program-stage-filter-menu')
        await expect
            .poll(() =>
                document.querySelector(
                    '[data-test="select-filter-stage-Stage000002"]'
                )
            )
            .not.toBeNull()
        for (const [stageName, stageId] of [
            ['Visit', 'Stage000001'],
            ['Follow-up', 'Stage000002'],
        ] as const) {
            const stageItem = menuItem(`select-filter-stage-${stageId}`)
            await expect
                .element(stageItem)
                .toHaveAttribute('aria-disabled', 'true')
            await expect.element(stageItem).toHaveAccessibleName(stageName)
            await expect
                .element(stageItem)
                .toHaveAccessibleDescription(
                    'Can only filter using one program stage.'
                )
            await expect.element(stageItem).toHaveAttribute('tabindex')
        }

        await menuItem('select-filter-stage-Stage000001').hover()
        await expect
            .poll(
                () =>
                    document.querySelector(
                        '[data-test="stage-lock-tooltip-Stage000001-content"]'
                    )?.textContent
            )
            .toBe('Can only filter using one program stage.')

        await openSubmenu('stage-filter-fields-Stage000001')
        await openSubmenu('add-stage-filter-Stage000001-DataElement01')
        expect(onAddStageFilter).toHaveBeenCalledWith(
            'Stage000001',
            'DataElement01'
        )
        await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
        await expect
            .element(screen.getByTestId('filter-DataElement01'))
            .toHaveTextContent('Visit / Result:')

        const clearStage = screen.container.querySelector<HTMLElement>(
            '[data-test="filter-programStage-select-clear"]'
        )
        expect(clearStage).not.toBeNull()
        clearStage?.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true })
        )
        await expect
            .poll(() =>
                screen.container.querySelector(
                    '[data-testid="filter-programStage"]'
                )
            )
            .toBeNull()
    })
})
