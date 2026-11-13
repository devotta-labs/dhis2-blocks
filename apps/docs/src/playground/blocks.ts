/** The blocks with a playground, in the docs navigation's order; `/playground` opens the first. */
export const PLAYGROUND_BLOCKS = [
    { slug: 'working-list', title: 'Working List' },
    { slug: 'observation-cards', title: 'Observation Cards' },
    { slug: 'timeline', title: 'Timeline' },
    { slug: 'tracked-entity-finder', title: 'Tracked Entity Finder' },
    { slug: 'tracked-entity-header', title: 'Tracked Entity Header' },
    { slug: 'tracker-data-entry', title: 'Tracker Data Entry' },
    { slug: 'shell', title: 'Shell' },
] as const

export type PlaygroundSlug = (typeof PLAYGROUND_BLOCKS)[number]['slug']
