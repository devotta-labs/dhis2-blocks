import { z } from 'zod'
import type { DataEngine } from '../../sources/types'

const uploadSchema = z.object({
    response: z.object({
        fileResource: z.object({ id: z.string(), name: z.string() }),
    }),
})

const nameSchema = z.object({ file: z.object({ name: z.string() }) })

// The names of the files uploaded on this page, from the uploads' own answers.
const uploadedNames = new Map<string, string>()

/** Uploads a file for a data value; DHIS2 keeps it unassigned until an event saves its id. Resolves to that id. */
export const uploadFile = async (
    engine: DataEngine,
    file: File,
    signal?: AbortSignal
): Promise<string> => {
    const { id, name } = uploadSchema.parse(
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
    uploadedNames.set(id, name)
    return id
}

/** The name a file was uploaded with; for a file uploaded on this page, known without asking. */
export const fileName = async (
    engine: DataEngine,
    id: string
): Promise<string> =>
    uploadedNames.get(id) ??
    nameSchema.parse(
        await engine.query({
            file: { resource: 'fileResources', id, params: { fields: 'name' } },
        })
    ).file.name

/** Where DHIS2 serves the file an event holds for a data element; an image can be shown from it. */
export const eventFileUrl = (
    baseUrl: string,
    eventId: string,
    dataElementId: string,
    image: boolean
): string =>
    `${baseUrl}/api/tracker/events/${eventId}/dataValues/${dataElementId}/${image ? 'image' : 'file'}`
