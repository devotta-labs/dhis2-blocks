import React from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { LivePreviewHost } from '../preview/LivePreviewHost'
import { PreviewSpinner } from '../preview/PreviewShell'
import { Lab } from './Lab'
import { CustomFunctionsLab } from './CustomFunctionsLab'

/**
 * Production publishes only the offline custom-functions lab. Development retains the live data-entry lab.
 */
const root = document.getElementById('root')

if (!root) {
    throw new Error('Missing #root element')
}

createRoot(root).render(
    <React.StrictMode>
        {import.meta.env.PROD ||
        new URLSearchParams(window.location.search).get('mode') === 'custom' ? (
            <CustomFunctionsLab />
        ) : (
            <LivePreviewHost placeholder={<PreviewSpinner />}>
                <Lab />
            </LivePreviewHost>
        )}
    </React.StrictMode>
)
