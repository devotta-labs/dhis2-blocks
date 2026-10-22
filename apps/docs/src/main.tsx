import { MDXProvider } from '@mdx-js/react'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { mdxComponents } from './components/mdx-components'
import './index.css'

const root = document.getElementById('root')

if (!root) {
    throw new Error('Missing #root element')
}

createRoot(root).render(
    <React.StrictMode>
        <MDXProvider components={mdxComponents}>
            <App />
        </MDXProvider>
    </React.StrictMode>
)
