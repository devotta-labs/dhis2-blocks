/** The blocks with a playground, in the docs navigation's order; `/playground` opens the first. */
export const PLAYGROUND_BLOCKS = [
    { slug: 'working-list', title: 'Working List' },
    { slug: 'observation-cards', title: 'Observation Cards' },
    { slug: 'timeline', title: 'Timeline' },
    { slug: 'tracked-entity-finder', title: 'Tracked Entity Finder' },
    { slug: 'tracker-data-entry', title: 'Tracker Data Entry' },
] as const

export type PlaygroundSlug = (typeof PLAYGROUND_BLOCKS)[number]['slug']
