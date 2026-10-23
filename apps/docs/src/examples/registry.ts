import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import contextSelectorBasicSource from './context-selector/ContextSelectorBasic.tsx?raw'
import contextSelectorStatesSource from './context-selector/ContextSelectorStates.tsx?raw'
import {
    WorkingListDefaultPlaceholder,
    WorkingListProgramPickerPlaceholder,
} from './working-list/WorkingListPlaceholders'
import workingListDefaultSource from './working-list/WorkingListDefault.tsx?raw'
import workingListProgramPickerSource from './working-list/WorkingListProgramPicker.tsx?raw'
import sidebarBasicSource from './sidebar/SidebarBasic.tsx?raw'
import sidebarControlledSource from './sidebar/SidebarControlled.tsx?raw'
import finderCustomRowsSource from './tracked-entity-finder/CustomRows.tsx?raw'
import finderFindPersonSource from './tracked-entity-finder/FindPerson.tsx?raw'
import finderProgramPickerSource from './tracked-entity-finder/ProgramPicker.tsx?raw'

/**
 * Example registry.
 *
 * Every entry is one self-contained React component that exercises the public
 * block API. The same module powers the rendered preview and the Code tab:
 * `source` is the raw example file itself, so the documentation can never
 * drift from what is executed. Readers copy that source into their own
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
    source: string
    minHeight: number
    Placeholder?: ComponentType
}

const examples = [
    {
        slug: 'sidebar/basic',
        title: 'Sidebar navigation',
        live: false,
        Component: lazy(() => import('./sidebar/SidebarBasic')),
        source: sidebarBasicSource,
        minHeight: 680,
    },
    {
        slug: 'sidebar/controlled',
        title: 'Controlled sidebar',
        live: false,
        Component: lazy(() => import('./sidebar/SidebarControlled')),
        source: sidebarControlledSource,
        minHeight: 360,
    },
    {
        slug: 'working-list/default',
        title: 'Default Working List',
        live: true,
        Component: lazy(() => import('./working-list/WorkingListDefault')),
        source: workingListDefaultSource,
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
        source: workingListProgramPickerSource,
        minHeight: 730,
        Placeholder: WorkingListProgramPickerPlaceholder,
    },
    {
        slug: 'context-selector/basic',
        title: 'Registration context',
        live: false,
        Component: lazy(
            () => import('./context-selector/ContextSelectorBasic')
        ),
        source: contextSelectorBasicSource,
        minHeight: 220,
    },
    {
        slug: 'context-selector/states',
        title: 'Selector primitives and states',
        live: false,
        Component: lazy(
            () => import('./context-selector/ContextSelectorStates')
        ),
        source: contextSelectorStatesSource,
        minHeight: 340,
    },
    {
        slug: 'tracked-entity-finder/find-person',
        title: 'Find a person by ID',
        live: true,
        Component: lazy(() => import('./tracked-entity-finder/FindPerson')),
        source: finderFindPersonSource,
        minHeight: 360,
    },
    {
        slug: 'tracked-entity-finder/custom-rows',
        title: 'Composed results',
        live: true,
        Component: lazy(() => import('./tracked-entity-finder/CustomRows')),
        source: finderCustomRowsSource,
        minHeight: 360,
    },
    {
        slug: 'tracked-entity-finder/program-picker',
        title: 'Program from a select',
        live: true,
        Component: lazy(() => import('./tracked-entity-finder/ProgramPicker')),
        source: finderProgramPickerSource,
        minHeight: 520,
    },
] as const satisfies readonly ExampleDefinition[]

export type ExampleSlug = (typeof examples)[number]['slug']

export const getExample = (slug: string): ExampleDefinition | undefined =>
    examples.find((example) => example.slug === slug)
