/** The blocks with a playground, in the docs navigation's order; `/playground` opens the first. */
export const PLAYGROUND_BLOCKS = [
    { slug: 'working-list-calendar', title: 'Working List Calendar' },
    { slug: 'observation-cards', title: 'Observation Cards' },
] as const

export type PlaygroundSlug = (typeof PLAYGROUND_BLOCKS)[number]['slug']
