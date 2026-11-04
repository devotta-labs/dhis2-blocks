interface NavigationLink {
    title: string
    href: string
}

interface NavigationCategory {
    title: string
    links: readonly NavigationLink[]
}

/** A top-level part of the sidebar: its pages, or categories of them. */
type NavigationSection =
    | { title: string; links: readonly NavigationLink[] }
    | { title: string; categories: readonly NavigationCategory[] }

export const docsNavigation: readonly NavigationSection[] = [
    {
        title: 'Getting started',
        links: [
            { title: 'Introduction', href: '/' },
            { title: 'Installation', href: '/installation' },
        ],
    },
    {
        title: 'Blocks',
        categories: [
            {
                title: 'General',
                links: [
                    { title: 'Alert', href: '/blocks/alert' },
                    { title: 'Badge', href: '/blocks/badge' },
                    { title: 'Button', href: '/blocks/button' },
                    { title: 'Card', href: '/blocks/card' },
                    { title: 'Chart', href: '/blocks/chart' },
                    { title: 'Checkbox', href: '/blocks/checkbox' },
                    { title: 'Combobox', href: '/blocks/combobox' },
                    {
                        title: 'Context Selector',
                        href: '/blocks/context-selector',
                    },
                    { title: 'Dialog', href: '/blocks/dialog' },
                    { title: 'Dropdown Menu', href: '/blocks/dropdown-menu' },
                    { title: 'Input', href: '/blocks/input' },
                    { title: 'Input Group', href: '/blocks/input-group' },
                    { title: 'Popover', href: '/blocks/popover' },
                    { title: 'Radio Group', href: '/blocks/radio-group' },
                    { title: 'Select', href: '/blocks/select' },
                    { title: 'Sidebar', href: '/blocks/sidebar' },
                    { title: 'Spinner', href: '/blocks/spinner' },
                    { title: 'Switch', href: '/blocks/switch' },
                    { title: 'Table', href: '/blocks/table' },
                    { title: 'Textarea', href: '/blocks/textarea' },
                    { title: 'Toggle Group', href: '/blocks/toggle-group' },
                    { title: 'Tooltip', href: '/blocks/tooltip' },
                ],
            },
            {
                title: 'EMR',
                links: [
                    { title: 'Working List', href: '/blocks/working-list' },
                    {
                        title: 'Observation Cards',
                        href: '/blocks/observation-cards',
                    },
                    { title: 'Timeline', href: '/blocks/timeline' },
                    {
                        title: 'Tracked Entity Finder',
                        href: '/blocks/tracked-entity-finder',
                    },
                ],
            },
            { title: 'Data entry', links: [] },
        ],
    },
]
