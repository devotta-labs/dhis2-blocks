import { useDataQuery } from '@dhis2/app-runtime'
import { ProgramSelector, type Option } from '@dhis2-blocks/context-selector'
import {
    WorkingList,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListViewSwitcher,
} from '@dhis2-blocks/working-list'
import { useState } from 'react'
import { z } from 'zod'
import { PreviewShell } from '../../preview/PreviewShell'
import { WorkingListProgramPickerFallback } from './WorkingListFallbacks'

/**
 * Metadata-driven Working List.
 *
 * Programs and the signed-in user's organisation units come from the live
 * API, so the example is usable on any DHIS2 instance — not only the seeded
 * demo. Changing the program remounts the list through React's `key`.
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

    // Keep the preview's loading placeholder up while metadata loads.
    if (loading) {
        return <WorkingListProgramPickerFallback />
    }

    if (error) {
        return (
            <PreviewShell>
                <p className="text-sm text-[#a03030]">
                    Could not load program metadata: {error.message}
                </p>
            </PreviewShell>
        )
    }

    const parsed = metadataSchema.safeParse(data)

    if (!parsed.success) {
        return (
            <PreviewShell>
                <p className="text-sm text-[#a03030]">
                    Unexpected metadata response from the server.
                </p>
            </PreviewShell>
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

    // Prefer a unit the selected program is actually assigned to, not just
    // the user's first unit — otherwise the list misses records for programs
    // restricted to a subset of the user's units. When none of the user's
    // units qualify (e.g. an admin holding only the root unit), fall back to
    // the first user unit so the example still renders.
    const selectedProgram = metadata.programs.programs.find(
        (program) => program.id === selectedProgramId
    )

    const assigned = new Set(
        selectedProgram?.organisationUnits.map((unit) => unit.id)
    )

    const userUnits = metadata.me.organisationUnits

    const assignedUserUnits = userUnits.filter((unit) => assigned.has(unit.id))

    // SELECTED org-unit mode only returns records at the chosen unit, so a
    // root-only user (admin on the demo data) gets nothing from their own
    // units — fall back to a unit the program is assigned to where the
    // enrollments actually live.
    const orgUnitId =
        assignedUserUnits[0]?.id ??
        selectedProgram?.organisationUnits[0]?.id ??
        userUnits[0]?.id

    return (
        <PreviewShell>
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
        </PreviewShell>
    )
}

export default WorkingListProgramPicker
