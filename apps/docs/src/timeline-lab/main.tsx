import React from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { TimelineLab } from './TimelineLab'

/**
 * The timeline lab, at `/timeline-lab.html` on the docs dev server: a page of its own, linked from nowhere and left
 * out of the docs build (Vite builds `index.html` only). Its data is made up, so it needs no DHIS2.
 */
const root = document.getElementById('root')

if (!root) {
    throw new Error('Missing #root element')
}

createRoot(root).render(
    <React.StrictMode>
        <TimelineLab />
    </React.StrictMode>
)
