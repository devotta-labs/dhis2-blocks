import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { FinderLab } from './FinderLab'

/**
 * The tracked entity finder lab, at `/finder-lab.html` on the docs dev server: a page of its own, linked from nowhere
 * and left out of the docs build (Vite builds `index.html` only). Live DHIS2 mode signs in through the same proxy as
 * the live examples; the lab program needs no server.
 */
const root = document.getElementById('root')

if (!root) {
    throw new Error('Missing #root element')
}

createRoot(root).render(
    <React.StrictMode>
        <FinderLab />
    </React.StrictMode>
)
