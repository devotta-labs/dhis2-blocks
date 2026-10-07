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
            fields: 'id,displayName',
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
            z.object({ id: z.string(), displayName: z.string() })
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

    if (loading) {
        return (
            <PreviewShell className="flex items-center justify-center">
                <span
                    className="size-5 animate-spin rounded-full border-2 border-[#d5dde5] border-t-[#2c6693] motion-reduce:animate-none"
                    aria-hidden="true"
                />
                <span className="sr-only">Loading metadata…</span>
            </PreviewShell>
        )
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

    const orgUnitId = metadata.me.organisationUnits[0]?.id
    const selectedProgramId = programId ?? options[0]?.value

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
