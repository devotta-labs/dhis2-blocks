import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import contextSelectorBasicSource from './context-selector/ContextSelectorBasic.tsx?raw'
import contextSelectorStatesSource from './context-selector/ContextSelectorStates.tsx?raw'
import workingListDefaultSource from './working-list/WorkingListDefault.tsx?raw'
import workingListProgramPickerSource from './working-list/WorkingListProgramPicker.tsx?raw'

/**
 * Example registry.
 *
 * Every entry is one self-contained React component that exercises the public
 * block API. The same module powers the rendered preview and the Code tab:
 * `source` is the raw example file itself, so the documentation can never
 * drift from what is executed.
 *
 * `live: true` examples render inside the shared DHIS2 adapter host and
 * require a reachable backend; `live: false` examples render standalone.
 */
export interface ExampleDefinition {
    slug: string
    title: string
    live: boolean
    Component: LazyExoticComponent<ComponentType>
    source: string
    minHeight: number
}

const examples = [
    {
        slug: 'working-list/default',
        title: 'Default Working List',
        live: true,
        Component: lazy(() => import('./working-list/WorkingListDefault')),
        source: workingListDefaultSource,
        minHeight: 730,
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
] as const satisfies readonly ExampleDefinition[]

export type ExampleSlug = (typeof examples)[number]['slug']

export const getExample = (slug: string) =>
    examples.find((example) => example.slug === slug)
