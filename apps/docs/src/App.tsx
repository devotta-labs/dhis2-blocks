import { createElement, lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { DocPage } from './components/DocPage'
import { DocsShell } from './components/DocsShell'
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
        element: <DocsShell />,
        children: [
            docRoute('/', './pages/index.mdx'),
            docRoute('/installation', './pages/installation.mdx'),
            // The former name of the installation page.
            {
                path: '/getting-started',
                element: <Navigate to="/installation" replace />,
            },
            docRoute('/blocks/working-list', './pages/blocks/working-list.mdx'),
            docRoute('/blocks/sidebar', './pages/blocks/sidebar.mdx'),
            docRoute('/blocks/timeline', './pages/blocks/timeline.mdx'),
            docRoute(
                '/blocks/context-selector',
                './pages/blocks/context-selector.mdx'
            ),
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
