import { useDataEngine } from '@dhis2/app-runtime'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import type { DataEngine } from '../../provider/context'

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

/** A file on its way to DHIS2, and what stops it: a mutation is not cancelled by leaving it. */
export interface FileUpload {
    file: File
    controller: AbortController
}

type Uploaded = Awaited<ReturnType<typeof uploadFile>>

/**
 * Uploads a file. `onSuccess` and `onError` are those of the render that started the upload, and run when it ends
 * even if the editor has closed by then.
 */
export const useUploadFile = (handlers: {
    onSuccess(uploaded: Uploaded, upload: FileUpload): void
    onError(error: Error, upload: FileUpload): void
}) => {
    const engine = useDataEngine()
    return useMutation({
        mutationFn: ({ file, controller }: FileUpload) =>
            uploadFile(engine, file, controller.signal),
        // Tried even when the browser says it is offline: the failure then says so, where a paused upload says nothing.
        networkMode: 'always',
        ...handlers,
    })
}
