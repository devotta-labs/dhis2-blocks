import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ObservationsLab } from './ObservationsLab'

/**
 * The observation cards lab, at `/observation-cards-lab.html` on the docs dev server: a page of its own, linked
 * from nowhere and left out of the docs build (Vite builds `index.html` only). Live DHIS2 mode signs in through the
 * same proxy as the live examples; lab data needs no server.
 */
const root = document.getElementById('root')

if (!root) {
    throw new Error('Missing #root element')
}

createRoot(root).render(
    <React.StrictMode>
        <ObservationsLab />
    </React.StrictMode>
)
