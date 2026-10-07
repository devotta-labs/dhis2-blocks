import { WORKING_LIST_PAGE_SIZES } from '@dhis2-blocks/working-list/development'
import { z } from 'zod'

const WorkingListPageSizeSchema = z.coerce
    .number()
    .pipe(
        z.union([
            z.literal(WORKING_LIST_PAGE_SIZES[0]),
            z.literal(WORKING_LIST_PAGE_SIZES[1]),
            z.literal(WORKING_LIST_PAGE_SIZES[2]),
            z.literal(WORKING_LIST_PAGE_SIZES[3]),
            z.literal(WORKING_LIST_PAGE_SIZES[4]),
        ])
    )

const WorkingListUrlStateSchema = z
    .object({
        programId: z.string().min(1).optional(),
        orgUnitId: z.string().min(1).optional(),
        selectedTemplateId: z.string().min(1).optional(),
        page: z.coerce.number().int().positive().optional(),
        pageSize: WorkingListPageSizeSchema.optional(),
    })
    .strict()

export type AppUrlState = z.infer<typeof WorkingListUrlStateSchema>

const ALLOWED_KEYS = [
    'programId',
    'orgUnitId',
    'selectedTemplateId',
    'page',
    'pageSize',
] as const

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

    return WorkingListUrlStateSchema.parse(candidate)
}

export const serializeAppUrlState = (state: AppUrlState) => {
    const validated = WorkingListUrlStateSchema.parse(state)
    const parameters = new URLSearchParams()

    for (const key of ALLOWED_KEYS) {
        const value = validated[key]

        if (value !== undefined) {
            parameters.set(key, String(value))
        }
    }

    return parameters.toString()
}

export const isGuardedAppUrlTransition = (
    current: AppUrlState,
    next: AppUrlState
) =>
    current.programId !== next.programId ||
    current.selectedTemplateId !== next.selectedTemplateId
