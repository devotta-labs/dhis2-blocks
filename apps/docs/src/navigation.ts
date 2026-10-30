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
            { title: 'Context Selector', href: '/blocks/context-selector' },
            { title: 'Sidebar', href: '/blocks/sidebar' },
            {
                title: 'Tracked Entity Finder',
                href: '/blocks/tracked-entity-finder',
            },
        ],
    },
]
