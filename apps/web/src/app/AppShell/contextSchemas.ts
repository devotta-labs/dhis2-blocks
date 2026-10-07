import { z, ZodError } from 'zod'

export const OrganisationUnitReferenceSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        path: z.string().min(1),
    })
    .passthrough()

export const CurrentUserSchema = z
    .object({
        organisationUnits: z.array(OrganisationUnitReferenceSchema),
        teiSearchOrganisationUnits: z
            .array(OrganisationUnitReferenceSchema)
            .optional(),
    })
    .passthrough()

export const ProgramOrganisationUnitsSchema = z
    .object({
        organisationUnits: z.array(OrganisationUnitReferenceSchema),
    })
    .passthrough()

export const OrganisationUnitsResponseSchema = z
    .object({
        organisationUnits: z.array(OrganisationUnitReferenceSchema),
        pager: z
            .object({
                page: z.number(),
                pageSize: z.number(),
                total: z.number(),
            })
            .passthrough()
            .optional(),
    })
    .passthrough()

export const AppRuntimeConfigSchema = z
    .object({
        apiVersion: z.coerce.number().int().positive(),
        baseUrl: z.string(),
    })
    .passthrough()

export const retryOperationalError = (failureCount: number, error: Error) =>
    !(error instanceof ZodError) && failureCount < 2
