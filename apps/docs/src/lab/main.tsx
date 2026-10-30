import React from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { LivePreviewHost } from '../preview/LivePreviewHost'
import { PreviewSpinner } from '../preview/PreviewShell'
import { Lab } from './Lab'

/**
 * The data entry lab, at `/lab.html` on the docs dev server: a page of its own, linked from nowhere and left out of
 * the docs build (Vite builds `index.html` only). It signs in through the same proxy as the live examples.
 */
const root = document.getElementById('root')

if (!root) {
    throw new Error('Missing #root element')
}

createRoot(root).render(
    <React.StrictMode>
        <LivePreviewHost placeholder={<PreviewSpinner />}>
            <Lab />
        </LivePreviewHost>
    </React.StrictMode>
)
