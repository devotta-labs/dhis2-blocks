import { PATIENT_LIST_PAGE_SIZES } from '@/components/patient-list'
import { z } from 'zod'

const AppPageSizeSchema = z.coerce
    .number()
    .pipe(
        z.union([
            z.literal(PATIENT_LIST_PAGE_SIZES[0]),
            z.literal(PATIENT_LIST_PAGE_SIZES[1]),
            z.literal(PATIENT_LIST_PAGE_SIZES[2]),
            z.literal(PATIENT_LIST_PAGE_SIZES[3]),
            z.literal(PATIENT_LIST_PAGE_SIZES[4]),
        ])
    )

/** A page size the list reports, checked against the sizes the URL allows. */
export const parseAppPageSize = (pageSize: number) =>
    AppPageSizeSchema.parse(pageSize)

const AppUrlStateSchema = z
    .object({
        programId: z.string().min(1).optional(),
        orgUnitId: z.string().min(1).optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: AppPageSizeSchema.optional(),
    })
    .strict()

export type AppUrlState = z.infer<typeof AppUrlStateSchema>

const ALLOWED_KEYS = ['programId', 'orgUnitId', 'page', 'pageSize'] as const

const SingleUrlParameterSchema = z.array(z.string()).length(1)

export const parseAppUrlState = (parameters: URLSearchParams): AppUrlState => {
    const candidate = Object.fromEntries(
        ALLOWED_KEYS.flatMap((key) => {
            if (!parameters.has(key)) {
                return []
            }
            const [value] = SingleUrlParameterSchema.parse(
                parameters.getAll(key)
            )
            return [[key, value]]
        })
    )
    return AppUrlStateSchema.parse(candidate)
}

export const serializeAppUrlState = (state: AppUrlState) => {
    const validated = AppUrlStateSchema.parse(state)
    const parameters = new URLSearchParams()
    for (const key of ALLOWED_KEYS) {
        const value = validated[key]
        if (value !== undefined) {
            parameters.set(key, String(value))
        }
    }
    return parameters.toString()
}
