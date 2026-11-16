import type { useDataEngine } from '@dhis2/app-runtime'
import { z } from 'zod'

export type DataEngine = ReturnType<typeof useDataEngine>

const uploadSchema = z.object({
    response: z.object({
        fileResource: z.object({ id: z.string(), name: z.string() }),
    }),
})

/** Uploads a file for a data value; DHIS2 keeps it unassigned until an event saves its id. Resolves to that id and the name it was stored with. */
export const uploadFile = async (
    engine: DataEngine,
    file: File,
    signal?: AbortSignal
): Promise<{ id: string; name: string }> =>
    uploadSchema.parse(
        await engine.mutate(
            {
                resource: 'fileResources',
                type: 'create',
                // The platform sends this resource as multipart form data, one part per field.
                data: { file, domain: 'DATA_VALUE' },
            },
            { signal }
        )
    ).response.fileResource
