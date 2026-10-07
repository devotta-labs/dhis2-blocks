import {
    ClearSelections,
    ContextSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    type Option,
} from '@dhis2-blocks/context-selector'
import { useState } from 'react'
import { PreviewShell } from '../../preview/PreviewShell'

/**
 * Registration context with controlled sample data.
 *
 * The Context Selector block is presentational: the host owns every option,
 * committed value, and open state. No DHIS2 connection is needed for this
 * example — that is why it also renders when offline or signed out.
 */
const programOptions: readonly Option[] = [
    { value: 'malaria', label: 'Malaria case registration' },
    { value: 'tuberculosis', label: 'Tuberculosis program' },
    { value: 'antenatal', label: 'Antenatal care' },
    { value: 'child-health', label: 'Child health' },
    { value: 'immunisation', label: 'Immunisation registry' },
    { value: 'nutrition', label: 'Nutrition surveillance' },
]

const organisationUnits = [
    'Ngelehun CHC',
    'Njandama MCHP',
    'Bo Government Hospital',
]

type SelectorName = 'program' | 'organisationUnit'

const ContextSelectorBasic = () => {
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
        <PreviewShell className="min-h-0 p-0">
            <ContextSelector ariaLabel="Registration context">
                <ProgramSelector
                    options={programOptions}
                    value={programId}
                    onChange={setProgramId}
                    onClear={() => setProgramId(undefined)}
                    searchPlaceholder="Search programs"
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

export default ContextSelectorBasic
