import { PLAYGROUND_BLOCKS } from './playground/blocks'

interface NavigationLink {
    title: string
    href: string
}

interface NavigationGroup {
    title: string
    items: readonly NavigationLink[]
}

export const docsNavigation: readonly NavigationGroup[] = [
    {
        title: 'Getting started',
        items: [
            { title: 'Introduction', href: '/' },
            { title: 'Installation', href: '/installation' },
        ],
    },
    {
        title: 'Blocks',
        items: [
            { title: 'Working List', href: '/blocks/working-list' },
            {
                title: 'Working List Calendar',
                href: '/blocks/working-list-calendar',
            },
            { title: 'Context Selector', href: '/blocks/context-selector' },
            { title: 'Sidebar', href: '/blocks/sidebar' },
            { title: 'Observation Cards', href: '/blocks/observation-cards' },
        ],
    },
    {
        title: 'Playground',
        items: PLAYGROUND_BLOCKS.map(({ slug, title }) => ({
            title,
            href: `/playground/${slug}`,
        })),
    },
]
