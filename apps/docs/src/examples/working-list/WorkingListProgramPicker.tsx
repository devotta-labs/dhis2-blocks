import { useDataQuery } from '@dhis2/app-runtime'
import { ProgramSelector, type Option } from '@/components/context-selector'
import {
    WorkingList,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListViewSwitcher,
} from '@/components/working-list'
import { useState } from 'react'
import { z } from 'zod'
import { WorkingListProgramPickerPlaceholder } from './WorkingListPlaceholders'

/**
 * Working List with a program picker.
 *
 * Tracker programs and the signed-in user's organisation units are loaded
 * from the API, so this works on any DHIS2 instance. `key={programId}` gives
 * each program a fresh list.
 */
const metadataQuery = {
    programs: {
        resource: 'programs',
        params: {
            fields: 'id,displayName,organisationUnits[id]',
            paging: false,
            filter: 'programType:eq:WITH_REGISTRATION',
        },
    },
    me: {
        resource: 'me',
        params: { fields: 'organisationUnits[id,displayName]' },
    },
}

const metadataSchema = z.object({
    programs: z.object({
        programs: z.array(
            z.object({
                id: z.string(),
                displayName: z.string(),
                organisationUnits: z.array(z.object({ id: z.string() })),
            })
        ),
    }),
    me: z.object({
        organisationUnits: z.array(
            z.object({ id: z.string(), displayName: z.string() })
        ),
    }),
})

const WorkingListProgramPicker = () => {
    const { loading, error, data } = useDataQuery(metadataQuery)
    const [programId, setProgramId] = useState<string | undefined>()
    const [menuOpen, setMenuOpen] = useState(false)

    // Replace with your app's loading state.
    if (loading) {
        return <WorkingListProgramPickerPlaceholder />
    }

    if (error) {
        return (
            <p className="text-sm text-[#a03030]">
                Could not load program metadata: {error.message}
            </p>
        )
    }

    const parsed = metadataSchema.safeParse(data)

    if (!parsed.success) {
        return (
            <p className="text-sm text-[#a03030]">
                Unexpected metadata response from the server.
            </p>
        )
    }

    const metadata = parsed.data

    const options: readonly Option[] = metadata.programs.programs.map(
        (program) => ({
            value: program.id,
            label: program.displayName,
        })
    )

    const selectedProgramId = programId ?? options[0]?.value

    // Prefer one of the user's units that the program is assigned to;
    // records only exist in units the program is assigned to.
    const selectedProgram = metadata.programs.programs.find(
        (program) => program.id === selectedProgramId
    )

    const assigned = new Set(
        selectedProgram?.organisationUnits.map((unit) => unit.id)
    )

    const userUnits = metadata.me.organisationUnits

    const assignedUserUnits = userUnits.filter((unit) => assigned.has(unit.id))

    // The list shows records in the selected unit only, so a user assigned
    // only to the root unit falls back to one of the program's own units.
    const orgUnitId =
        assignedUserUnits[0]?.id ??
        selectedProgram?.organisationUnits[0]?.id ??
        userUnits[0]?.id

    return (
        <>
            <div className="mb-4 w-full max-w-sm">
                <ProgramSelector
                    options={options}
                    value={selectedProgramId}
                    onChange={setProgramId}
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    searchPlaceholder="Search programs"
                />
            </div>

            {selectedProgramId && orgUnitId ? (
                <WorkingList
                    key={selectedProgramId}
                    programId={selectedProgramId}
                    orgUnitId={orgUnitId}
                    defaultPagination={{ page: 1, pageSize: 10 }}
                >
                    <WorkingListViewSwitcher />
                    <WorkingListToolbar />
                    <WorkingListTable />
                </WorkingList>
            ) : (
                <p className="text-sm text-[#4a5768]">
                    No tracker program or organisation unit is available for
                    this user.
                </p>
            )}
        </>
    )
}

export default WorkingListProgramPicker
