interface NavigationItem {
    title: string
    href: string
}

interface NavigationGroup {
    title: string
    items: readonly NavigationItem[]
}

export const docsNavigation: readonly NavigationGroup[] = [
    {
        title: 'Getting started',
        items: [
            { title: 'Introduction', href: '/' },
            { title: 'Setup', href: '/getting-started' },
        ],
    },
    {
        title: 'Blocks',
        items: [
            { title: 'Working List', href: '/blocks/working-list' },
            { title: 'Context Selector', href: '/blocks/context-selector' },
        ],
    },
]
