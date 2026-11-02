import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ExampleLab } from './ExampleLab'

/**
 * The example lab, at `/example-lab.html` on the docs dev server: a page of its
 * own, linked from nowhere and left out of the docs build (Vite builds
 * `index.html` only).
 */
const root = document.getElementById('root')

if (!root) {
    throw new Error('Missing #root element')
}

createRoot(root).render(
    <React.StrictMode>
        <ExampleLab />
    </React.StrictMode>
)
