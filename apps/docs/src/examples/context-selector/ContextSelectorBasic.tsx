import {
    ClearSelections,
    ContextSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    type Option,
} from '@/components/context-selector'
import { useState } from 'react'

/**
 * Registration context with sample data.
 *
 * Your app owns every option, selected value, and open menu. Replace the
 * sample programs and organisation units with data from your DHIS2 instance.
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
        <>
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
        </>
    )
}

export default ContextSelectorBasic
