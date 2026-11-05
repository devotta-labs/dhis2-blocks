import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import calendarVisitsSource from './calendar/CalendarVisits.tsx?raw'
import contextSelectorBasicSource from './context-selector/ContextSelectorBasic.tsx?raw'
import contextSelectorStatesSource from './context-selector/ContextSelectorStates.tsx?raw'
import { PersonVitalsPlaceholder } from './observation-cards/ObservationCardsPlaceholders'
import personVitalsSource from './observation-cards/PersonVitals.tsx?raw'
import {
    WorkingListDefaultPlaceholder,
    WorkingListProgramPickerPlaceholder,
} from './working-list/WorkingListPlaceholders'
import workingListDefaultSource from './working-list/WorkingListDefault.tsx?raw'
import workingListProgramPickerSource from './working-list/WorkingListProgramPicker.tsx?raw'
import workingListCalendarTabsSource from './working-list/WorkingListCalendarTabs.tsx?raw'
import workingListPlaceholdersSource from './working-list/WorkingListPlaceholders.tsx?raw'
import listCalendarSource from './working-list/ListCalendar.tsx?raw'
import alertVariantsSource from './ui/AlertVariants.tsx?raw'
import badgeStatusSource from './ui/BadgeStatus.tsx?raw'
import buttonVariantsSource from './ui/ButtonVariants.tsx?raw'
import cardFacilitiesSource from './ui/CardFacilities.tsx?raw'
import chartShareSource from './ui/ChartShare.tsx?raw'
import chartTrendSource from './ui/ChartTrend.tsx?raw'
import chartVisitsSource from './ui/ChartVisits.tsx?raw'
import checkboxOptionsSource from './ui/CheckboxOptions.tsx?raw'
import comboboxOrgUnitsSource from './ui/ComboboxOrgUnits.tsx?raw'
import dialogConfirmSource from './ui/DialogConfirm.tsx?raw'
import dropdownMenuActionsSource from './ui/DropdownMenuActions.tsx?raw'
import inputFieldSource from './ui/InputField.tsx?raw'
import inputGroupSearchSource from './ui/InputGroupSearch.tsx?raw'
import popoverDetailsSource from './ui/PopoverDetails.tsx?raw'
import radioGroupOutcomeSource from './ui/RadioGroupOutcome.tsx?raw'
import selectPeriodSource from './ui/SelectPeriod.tsx?raw'
import spinnerSizesSource from './ui/SpinnerSizes.tsx?raw'
import switchSettingsSource from './ui/SwitchSettings.tsx?raw'
import tableRecordsSource from './ui/TableRecords.tsx?raw'
import textareaNotesSource from './ui/TextareaNotes.tsx?raw'
import toggleGroupViewSource from './ui/ToggleGroupView.tsx?raw'
import tooltipHintSource from './ui/TooltipHint.tsx?raw'
import sidebarBasicSource from './sidebar/SidebarBasic.tsx?raw'
import { TimelinePlaceholder } from './timeline/TimelinePlaceholder'
import timelineCaseHistorySource from './timeline/TimelineCaseHistory.tsx?raw'
import timelineEntryPartsSource from './timeline/TimelineEntryParts.tsx?raw'
import timelineOwnDataSource from './timeline/TimelineOwnData.tsx?raw'
import sidebarControlledSource from './sidebar/SidebarControlled.tsx?raw'
import finderCustomRowsSource from './tracked-entity-finder/CustomRows.tsx?raw'
import finderFindPersonSource from './tracked-entity-finder/FindPerson.tsx?raw'
import finderProgramPickerSource from './tracked-entity-finder/ProgramPicker.tsx?raw'

/**
 * Example registry.
 *
 * Every entry exercises the public block API. The same modules power the
 * rendered preview and the Code tab: `sourceFiles` lists the entry file first,
 * then every local dependency needed to copy the example, so docs never
 * drift from what is executed. Readers copy those sources into their own
 * projects, so examples import blocks from `@/components/<block>` (aliased to
 * the workspace source) and leave layout chrome to the preview hosts.
 *
 * `live: true` examples render inside the shared DHIS2 adapter host and
 * require a reachable backend; `live: false` examples render standalone.
 *
 * `Placeholder` is shown until the example renders — while its code loads and,
 * for live examples, while the adapter starts the DHIS2 session. Shape it
 * like the example's own loading state so the preview never changes layout
 * between owners; without one, a generic spinner is used.
 */
export interface ExampleDefinition {
    slug: string
    title: string
    live: boolean
    Component: LazyExoticComponent<ComponentType>
    sourceFiles: readonly [
        { name: string; code: string },
        ...{ name: string; code: string }[],
    ]
    minHeight: number
    Placeholder?: ComponentType
}

const examples = [
    {
        slug: 'calendar/visits',
        title: 'ANC visits',
        live: false,
        Component: lazy(() => import('./calendar/CalendarVisits')),
        sourceFiles: [
            { name: 'CalendarVisits.tsx', code: calendarVisitsSource },
        ],
        minHeight: 640,
    },
    {
        slug: 'sidebar/basic',
        title: 'Sidebar navigation',
        live: false,
        Component: lazy(() => import('./sidebar/SidebarBasic')),
        sourceFiles: [{ name: 'SidebarBasic.tsx', code: sidebarBasicSource }],
        minHeight: 680,
    },
    {
        slug: 'sidebar/controlled',
        title: 'Controlled sidebar',
        live: false,
        Component: lazy(() => import('./sidebar/SidebarControlled')),
        sourceFiles: [
            { name: 'SidebarControlled.tsx', code: sidebarControlledSource },
        ],
        minHeight: 360,
    },
    {
        slug: 'working-list/default',
        title: 'Default Working List',
        live: true,
        Component: lazy(() => import('./working-list/WorkingListDefault')),
        sourceFiles: [
            { name: 'WorkingListDefault.tsx', code: workingListDefaultSource },
        ],
        minHeight: 730,
        Placeholder: WorkingListDefaultPlaceholder,
    },
    {
        slug: 'working-list/program-picker',
        title: 'Metadata-driven Working List',
        live: true,
        Component: lazy(
            () => import('./working-list/WorkingListProgramPicker')
        ),
        sourceFiles: [
            {
                name: 'WorkingListProgramPicker.tsx',
                code: workingListProgramPickerSource,
            },
            {
                name: 'WorkingListPlaceholders.tsx',
                code: workingListPlaceholdersSource,
            },
        ],
        minHeight: 730,
        Placeholder: WorkingListProgramPickerPlaceholder,
    },
    {
        slug: 'working-list/calendar',
        title: 'Working List as a calendar',
        live: true,
        Component: lazy(() => import('./working-list/WorkingListCalendarTabs')),
        sourceFiles: [
            {
                name: 'WorkingListCalendarTabs.tsx',
                code: workingListCalendarTabsSource,
            },
            { name: 'ListCalendar.tsx', code: listCalendarSource },
        ],
        minHeight: 900,
        Placeholder: WorkingListDefaultPlaceholder,
    },
    {
        slug: 'observation-cards/person-vitals',
        title: 'Observation cards',
        live: true,
        Component: lazy(() => import('./observation-cards/PersonVitals')),
        sourceFiles: [{ name: 'PersonVitals.tsx', code: personVitalsSource }],
        minHeight: 220,
        Placeholder: PersonVitalsPlaceholder,
    },
    {
        slug: 'timeline/case-history',
        title: 'Case history',
        live: true,
        Component: lazy(() => import('./timeline/TimelineCaseHistory')),
        sourceFiles: [
            {
                name: 'TimelineCaseHistory.tsx',
                code: timelineCaseHistorySource,
            },
        ],
        minHeight: 720,
        Placeholder: TimelinePlaceholder,
    },
    {
        slug: 'timeline/own-data',
        title: 'Your own data',
        live: false,
        Component: lazy(() => import('./timeline/TimelineOwnData')),
        sourceFiles: [
            { name: 'TimelineOwnData.tsx', code: timelineOwnDataSource },
        ],
        minHeight: 420,
    },
    {
        slug: 'timeline/entry-parts',
        title: 'Entry parts outside a timeline',
        live: false,
        Component: lazy(() => import('./timeline/TimelineEntryParts')),
        sourceFiles: [
            { name: 'TimelineEntryParts.tsx', code: timelineEntryPartsSource },
        ],
        minHeight: 260,
    },
    {
        slug: 'context-selector/basic',
        title: 'Registration context',
        live: false,
        Component: lazy(
            () => import('./context-selector/ContextSelectorBasic')
        ),
        sourceFiles: [
            {
                name: 'ContextSelectorBasic.tsx',
                code: contextSelectorBasicSource,
            },
        ],
        minHeight: 220,
    },
    {
        slug: 'context-selector/states',
        title: 'Selector primitives and states',
        live: false,
        Component: lazy(
            () => import('./context-selector/ContextSelectorStates')
        ),
        sourceFiles: [
            {
                name: 'ContextSelectorStates.tsx',
                code: contextSelectorStatesSource,
            },
        ],
        minHeight: 340,
    },
    {
        slug: 'tracked-entity-finder/find-person',
        title: 'Find a person by ID',
        live: true,
        Component: lazy(() => import('./tracked-entity-finder/FindPerson')),
        sourceFiles: [{ name: 'FindPerson.tsx', code: finderFindPersonSource }],
        minHeight: 360,
    },
    {
        slug: 'tracked-entity-finder/custom-rows',
        title: 'Composed results',
        live: true,
        Component: lazy(() => import('./tracked-entity-finder/CustomRows')),
        sourceFiles: [{ name: 'CustomRows.tsx', code: finderCustomRowsSource }],
        minHeight: 360,
    },
    {
        slug: 'tracked-entity-finder/program-picker',
        title: 'Program from a select',
        live: true,
        Component: lazy(() => import('./tracked-entity-finder/ProgramPicker')),
        sourceFiles: [
            { name: 'ProgramPicker.tsx', code: finderProgramPickerSource },
        ],
        minHeight: 520,
    },
    {
        slug: 'alert/variants',
        title: 'Alert messages',
        live: false,
        Component: lazy(() => import('./ui/AlertVariants')),
        sourceFiles: [{ name: 'AlertVariants.tsx', code: alertVariantsSource }],
        minHeight: 260,
    },
    {
        slug: 'button/variants',
        title: 'Button styles',
        live: false,
        Component: lazy(() => import('./ui/ButtonVariants')),
        sourceFiles: [
            { name: 'ButtonVariants.tsx', code: buttonVariantsSource },
        ],
        minHeight: 120,
    },
    {
        slug: 'chart/visits',
        title: 'Visits per month',
        live: false,
        Component: lazy(() => import('./ui/ChartVisits')),
        sourceFiles: [{ name: 'ChartVisits.tsx', code: chartVisitsSource }],
        minHeight: 340,
    },
    {
        slug: 'chart/trend',
        title: 'Coverage trend',
        live: false,
        Component: lazy(() => import('./ui/ChartTrend')),
        sourceFiles: [{ name: 'ChartTrend.tsx', code: chartTrendSource }],
        minHeight: 340,
    },
    {
        slug: 'chart/share',
        title: 'Cases by age group',
        live: false,
        Component: lazy(() => import('./ui/ChartShare')),
        sourceFiles: [{ name: 'ChartShare.tsx', code: chartShareSource }],
        minHeight: 340,
    },
    {
        slug: 'checkbox/options',
        title: 'Checkboxes',
        live: false,
        Component: lazy(() => import('./ui/CheckboxOptions')),
        sourceFiles: [
            { name: 'CheckboxOptions.tsx', code: checkboxOptionsSource },
        ],
        minHeight: 160,
    },
    {
        slug: 'combobox/facilities',
        title: 'Searchable facility picker',
        live: false,
        Component: lazy(() => import('./ui/ComboboxOrgUnits')),
        sourceFiles: [
            { name: 'ComboboxOrgUnits.tsx', code: comboboxOrgUnitsSource },
        ],
        minHeight: 420,
    },
    {
        slug: 'dialog/confirm',
        title: 'Dialogs',
        live: false,
        Component: lazy(() => import('./ui/DialogConfirm')),
        sourceFiles: [{ name: 'DialogConfirm.tsx', code: dialogConfirmSource }],
        minHeight: 120,
    },
    {
        slug: 'dropdown-menu/actions',
        title: 'Record actions menu',
        live: false,
        Component: lazy(() => import('./ui/DropdownMenuActions')),
        sourceFiles: [
            {
                name: 'DropdownMenuActions.tsx',
                code: dropdownMenuActionsSource,
            },
        ],
        minHeight: 300,
    },
    {
        slug: 'input/field',
        title: 'Text fields',
        live: false,
        Component: lazy(() => import('./ui/InputField')),
        sourceFiles: [{ name: 'InputField.tsx', code: inputFieldSource }],
        minHeight: 260,
    },
    {
        slug: 'select/period',
        title: 'Period select',
        live: false,
        Component: lazy(() => import('./ui/SelectPeriod')),
        sourceFiles: [{ name: 'SelectPeriod.tsx', code: selectPeriodSource }],
        minHeight: 320,
    },
    {
        slug: 'table/records',
        title: 'Records table',
        live: false,
        Component: lazy(() => import('./ui/TableRecords')),
        sourceFiles: [{ name: 'TableRecords.tsx', code: tableRecordsSource }],
        minHeight: 240,
    },
    {
        slug: 'tooltip/hint',
        title: 'Tooltips',
        live: false,
        Component: lazy(() => import('./ui/TooltipHint')),
        sourceFiles: [{ name: 'TooltipHint.tsx', code: tooltipHintSource }],
        minHeight: 140,
    },
    {
        slug: 'badge/status',
        title: 'Status badges',
        live: false,
        Component: lazy(() => import('./ui/BadgeStatus')),
        sourceFiles: [{ name: 'BadgeStatus.tsx', code: badgeStatusSource }],
        minHeight: 100,
    },
    {
        slug: 'card/facilities',
        title: 'Facility cards',
        live: false,
        Component: lazy(() => import('./ui/CardFacilities')),
        sourceFiles: [
            { name: 'CardFacilities.tsx', code: cardFacilitiesSource },
        ],
        minHeight: 220,
    },
    {
        slug: 'input-group/search',
        title: 'Search and unit fields',
        live: false,
        Component: lazy(() => import('./ui/InputGroupSearch')),
        sourceFiles: [
            { name: 'InputGroupSearch.tsx', code: inputGroupSearchSource },
        ],
        minHeight: 200,
    },
    {
        slug: 'popover/details',
        title: 'Value details',
        live: false,
        Component: lazy(() => import('./ui/PopoverDetails')),
        sourceFiles: [
            { name: 'PopoverDetails.tsx', code: popoverDetailsSource },
        ],
        minHeight: 260,
    },
    {
        slug: 'radio-group/outcome',
        title: 'Visit outcome',
        live: false,
        Component: lazy(() => import('./ui/RadioGroupOutcome')),
        sourceFiles: [
            { name: 'RadioGroupOutcome.tsx', code: radioGroupOutcomeSource },
        ],
        minHeight: 160,
    },
    {
        slug: 'spinner/sizes',
        title: 'Spinners',
        live: false,
        Component: lazy(() => import('./ui/SpinnerSizes')),
        sourceFiles: [{ name: 'SpinnerSizes.tsx', code: spinnerSizesSource }],
        minHeight: 120,
    },
    {
        slug: 'switch/settings',
        title: 'Settings switches',
        live: false,
        Component: lazy(() => import('./ui/SwitchSettings')),
        sourceFiles: [
            { name: 'SwitchSettings.tsx', code: switchSettingsSource },
        ],
        minHeight: 160,
    },
    {
        slug: 'textarea/notes',
        title: 'Visit note',
        live: false,
        Component: lazy(() => import('./ui/TextareaNotes')),
        sourceFiles: [{ name: 'TextareaNotes.tsx', code: textareaNotesSource }],
        minHeight: 200,
    },
    {
        slug: 'toggle-group/view',
        title: 'View switcher',
        live: false,
        Component: lazy(() => import('./ui/ToggleGroupView')),
        sourceFiles: [
            { name: 'ToggleGroupView.tsx', code: toggleGroupViewSource },
        ],
        minHeight: 140,
    },
] as const satisfies readonly ExampleDefinition[]

export type ExampleSlug = (typeof examples)[number]['slug']

export const getExample = (slug: string): ExampleDefinition | undefined =>
    examples.find((example) => example.slug === slug)
