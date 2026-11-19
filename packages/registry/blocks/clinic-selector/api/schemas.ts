import { z } from 'zod'

export interface Clinic {
    id: string
    displayName: string
    path: string
}

export interface AssignedClinic extends Clinic {
    hasChildren: boolean
}

/** Unknown fields are dropped, so a clinic is only these three. */
const ClinicSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    path: z.string(),
})

const AssignedClinicSchema = ClinicSchema.extend({
    children: z.boolean().optional(),
}).transform(({ children, ...clinic }): AssignedClinic => ({
    ...clinic,
    hasChildren: children ?? false,
}))

/** A user with no assigned units may come back without the field at all. */
export const MeSchema = z
    .object({
        id: z.string(),
        organisationUnits: z.array(AssignedClinicSchema).default([]),
    })
    .transform(({ id, organisationUnits }) => ({
        userId: id,
        assigned: organisationUnits,
    }))

export const SearchSchema = z
    .object({
        pager: z
            .object({
                page: z.number(),
                pageSize: z.number(),
                total: z.number(),
            })
            .optional(),
        organisationUnits: z.array(ClinicSchema),
    })
    .transform(({ pager, organisationUnits }) => ({
        clinics: organisationUnits,
        hasMore:
            pager !== undefined && pager.page * pager.pageSize < pager.total,
    }))

export const ByIdSchema = z
    .object({ organisationUnits: z.array(ClinicSchema) })
    .transform(({ organisationUnits }) => organisationUnits)
