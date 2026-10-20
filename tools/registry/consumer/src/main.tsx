import { createRoot } from 'react-dom/client'
import { ContextSelector } from '@/components/context-selector'
import { TrendCard } from '@/components/observation-cards'
import { WorkingList } from '@/components/working-list'
import { Host } from './host'
import './index.css'

// Type-level use only: the check compiles and bundles this file, never runs it.
const root = document.getElementById('root')
if (root !== null) {
    createRoot(root).render(
        <>
            <Host />
            <ContextSelector>{null}</ContextSelector>
            <WorkingList programId="program" orgUnitId="orgUnit">
                {null}
            </WorkingList>
            <TrendCard observation={{ status: 'pending' }} />
        </>
    )
}
