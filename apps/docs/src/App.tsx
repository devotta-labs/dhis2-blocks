import { createElement, lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { DocPage } from './components/DocPage'
import { DocsLayout, SiteShell } from './components/DocsShell'
import { PlaygroundPage } from './playground/PlaygroundPage'
import { PreviewRoot } from './preview/PreviewRoot'

type DocsPageModule = {
    default: ComponentType
    frontmatter?: {
        title?: string
        description?: string
    }
}

// Pages are .mdx files below src/pages; import.meta.glob keeps page
// registration automatic while knip and TypeScript stay out of MDX parsing.
const pageModules = import.meta.glob<DocsPageModule>('./pages/**/*.mdx')

const pageLoading = <div aria-hidden="true" className="h-48 animate-pulse" />

const mdxRoute = (modulePath: string) =>
    lazy(async () => {
        const loader = pageModules[modulePath]

        if (!loader) {
            throw new Error(`Documentation page not found: ${modulePath}`)
        }

        const module = await loader()

        return {
            default: () => (
                <DocPage
                    title={module.frontmatter?.title}
                    description={module.frontmatter?.description}
                >
                    <module.default />
                </DocPage>
            ),
        }
    })

const docRoute = (path: string, modulePath: string) => ({
    path,
    element: (
        <Suspense fallback={pageLoading}>
            {createElement(mdxRoute(modulePath))}
        </Suspense>
    ),
})

const router = createBrowserRouter([
    {
        element: <SiteShell />,
        children: [
            {
                element: <DocsLayout />,
                children: [
                    docRoute('/', './pages/index.mdx'),
                    docRoute('/installation', './pages/installation.mdx'),
                    // The former name of the installation page.
                    {
                        path: '/getting-started',
                        element: <Navigate to="/installation" replace />,
                    },
                    docRoute(
                        '/blocks/working-list',
                        './pages/blocks/working-list.mdx'
                    ),
                    // The calendar is now part of the Working List page.
                    {
                        path: '/blocks/working-list-calendar',
                        element: (
                            <Navigate
                                to="/blocks/working-list#calendar-view"
                                replace
                            />
                        ),
                    },
                    docRoute('/blocks/alert', './pages/blocks/alert.mdx'),
                    docRoute('/blocks/calendar', './pages/blocks/calendar.mdx'),
                    docRoute('/blocks/button', './pages/blocks/button.mdx'),
                    docRoute('/blocks/badge', './pages/blocks/badge.mdx'),
                    docRoute('/blocks/card', './pages/blocks/card.mdx'),
                    docRoute(
                        '/blocks/input-group',
                        './pages/blocks/input-group.mdx'
                    ),
                    docRoute('/blocks/popover', './pages/blocks/popover.mdx'),
                    docRoute(
                        '/blocks/radio-group',
                        './pages/blocks/radio-group.mdx'
                    ),
                    docRoute('/blocks/spinner', './pages/blocks/spinner.mdx'),
                    docRoute('/blocks/switch', './pages/blocks/switch.mdx'),
                    docRoute('/blocks/textarea', './pages/blocks/textarea.mdx'),
                    docRoute(
                        '/blocks/toggle-group',
                        './pages/blocks/toggle-group.mdx'
                    ),
                    docRoute('/blocks/chart', './pages/blocks/chart.mdx'),
                    docRoute('/blocks/checkbox', './pages/blocks/checkbox.mdx'),
                    docRoute('/blocks/combobox', './pages/blocks/combobox.mdx'),
                    docRoute('/blocks/dialog', './pages/blocks/dialog.mdx'),
                    docRoute(
                        '/blocks/dropdown-menu',
                        './pages/blocks/dropdown-menu.mdx'
                    ),
                    docRoute('/blocks/field', './pages/blocks/field.mdx'),
                    docRoute('/blocks/input', './pages/blocks/input.mdx'),
                    docRoute('/blocks/select', './pages/blocks/select.mdx'),
                    docRoute('/blocks/table', './pages/blocks/table.mdx'),
                    docRoute('/blocks/tooltip', './pages/blocks/tooltip.mdx'),
                    docRoute('/blocks/sidebar', './pages/blocks/sidebar.mdx'),
                    docRoute(
                        '/blocks/context-selector',
                        './pages/blocks/context-selector.mdx'
                    ),
                    docRoute(
                        '/blocks/dhis2-value-input',
                        './pages/blocks/dhis2-value-input.mdx'
                    ),
                    docRoute(
                        '/blocks/spreadsheet',
                        './pages/blocks/spreadsheet.mdx'
                    ),
                    docRoute(
                        '/blocks/tracker-data-entry',
                        './pages/blocks/tracker-data-entry.mdx'
                    ),
                    docRoute(
                        '/blocks/observation-cards',
                        './pages/blocks/observation-cards.mdx'
                    ),
                    docRoute('/blocks/timeline', './pages/blocks/timeline.mdx'),
                    docRoute(
                        '/blocks/tracked-entity-finder',
                        './pages/blocks/tracked-entity-finder.mdx'
                    ),
                    docRoute(
                        '/blocks/tracked-entity-header',
                        './pages/blocks/tracked-entity-header.mdx'
                    ),
                ],
            },
            { path: '/playground/:slug?', element: <PlaygroundPage /> },
        ],
    },
    {
        path: '/preview/*',
        element: <PreviewRoot />,
    },
    {
        path: '*',
        element: <Navigate to="/" replace />,
    },
])

const App = () => <RouterProvider router={router} />

export default App
