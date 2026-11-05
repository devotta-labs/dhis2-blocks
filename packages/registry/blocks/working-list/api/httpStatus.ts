import { z } from 'zod'

const RequestFailureSchema = z
    .object({
        status: z.number().optional(),
        response: z.object({ status: z.number().optional() }).optional(),
        details: z.object({ httpStatusCode: z.number().optional() }).optional(),
    })
    .passthrough()

export const getRequestErrorStatus = (cause: unknown) => {
    const parsed = RequestFailureSchema.safeParse(cause)
    return parsed.success
        ? (parsed.data.status ??
              parsed.data.response?.status ??
              parsed.data.details?.httpStatusCode)
        : undefined
}
