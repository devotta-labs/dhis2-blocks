/** What the canvas shows: the app, or one primitive on its own. */
export const EXAMPLES = [
    { group: 'Composition', name: 'App' },
    { group: 'Composition', name: 'Layout' },
    { group: 'Primitives', name: 'Pane' },
    { group: 'Primitives', name: 'PaneHeader' },
    { group: 'Primitives', name: 'Toolbar' },
    { group: 'Primitives', name: 'Section' },
] as const

type Example = (typeof EXAMPLES)[number]
export type ExampleName = Example['name']
export type PrimitiveExample = Exclude<ExampleName, 'App'>

/** Compact or comfortable throughout, or compact around a comfortable canvas. */
export type DensityMode = 'compact' | 'mixed' | 'comfortable'

export const outerDensity = (density: DensityMode) =>
    density === 'comfortable' ? 'comfortable' : 'compact'

export const canvasDensity = (density: DensityMode) =>
    density === 'mixed' ? 'comfortable' : undefined
