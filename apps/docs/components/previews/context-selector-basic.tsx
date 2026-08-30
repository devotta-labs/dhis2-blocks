'use client'

import {
    ClearSelections,
    ContextSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    type Option,
} from '@dhis2-blocks/context-selector'
import { useState } from 'react'
import { PreviewShell } from '@/components/previews/preview-shell'

const programOptions: readonly Option[] = [
    { value: 'malaria', label: 'Malaria case registration' },
    { value: 'tuberculosis', label: 'Tuberculosis program' },
    { value: 'antenatal', label: 'Antenatal care' },
    { value: 'child-health', label: 'Child health' },
    { value: 'immunisation', label: 'Immunisation registry' },
]

const organisationUnits = [
    'Ngelehun CHC',
    'Njandama MCHP',
    'Baoma Station CHP',
]

type SelectorName = 'program' | 'organisationUnit'

export function ContextSelectorBasicPreview() {
    const [programId, setProgramId] = useState<string | undefined>('malaria')
    const [organisationUnit, setOrganisationUnit] = useState<
        string | undefined
    >('Ngelehun CHC')
    const [openSelector, setOpenSelector] = useState<SelectorName>()

    const openProps = (name: SelectorName) => ({
        open: openSelector === name,
        onOpenChange: (open: boolean) =>
            setOpenSelector(open ? name : undefined),
    })

    return (
        <PreviewShell className="min-h-0">
            <ContextSelector ariaLabel="Context selector preview">
                <ProgramSelector
                    options={programOptions}
                    value={programId}
                    onChange={setProgramId}
                    onClear={() => setProgramId(undefined)}
                    {...openProps('program')}
                />
                <OrganisationUnitSelector
                    value={organisationUnit}
                    onClear={() => setOrganisationUnit(undefined)}
                    {...openProps('organisationUnit')}
                >
                    <ul className="m-0 list-none p-2">
                        {organisationUnits.map((unit) => (
                            <li key={unit}>
                                <button
                                    type="button"
                                    className="w-full cursor-pointer rounded border-none bg-transparent px-2 py-1.5 text-left text-sm hover:bg-[#f3f5f7]"
                                    onClick={() => {
                                        setOrganisationUnit(unit)
                                        setOpenSelector(undefined)
                                    }}
                                >
                                    {unit}
                                </button>
                            </li>
                        ))}
                    </ul>
                </OrganisationUnitSelector>
                <ClearSelections
                    onClear={() => {
                        setProgramId(undefined)
                        setOrganisationUnit(undefined)
                    }}
                    disabled={!programId && !organisationUnit}
                />
            </ContextSelector>
        </PreviewShell>
    )
}
