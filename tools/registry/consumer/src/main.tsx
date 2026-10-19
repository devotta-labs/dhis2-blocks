import { createRoot } from 'react-dom/client'
import { ContextSelector } from '@/components/context-selector'
import { WorkingList } from '@/components/working-list'
import { Host } from './host'
import { evaluate, useRules } from './rules'
import './index.css'

// Type-level use only: the check compiles and bundles this file, never runs it.
export const programRules = [evaluate, useRules]
const root = document.getElementById('root')
if (root !== null) {
    createRoot(root).render(
        <>
            <Host />
            <ContextSelector>{null}</ContextSelector>
            <WorkingList programId="program" orgUnitId="orgUnit">
                {null}
            </WorkingList>
        </>
    )
}
