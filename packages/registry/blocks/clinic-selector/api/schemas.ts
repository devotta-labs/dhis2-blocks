import { z } from 'zod'

export interface Clinic {
    id: string
    displayName: string
    path: string
}

export interface AssignedClinic extends Clinic {
    hasChildren: boolean
}

const ClinicSchema = z.looseObject({
    id: z.string(),
    displayName: z.string(),
    path: z.string(),
})

const AssignedClinicSchema = ClinicSchema.extend({
    children: z.boolean().optional(),
}).transform(({ id, displayName, path, children }): AssignedClinic => ({
    id,
    displayName,
    path,
    hasChildren: children ?? false,
}))

const toClinic = ({ id, displayName, path }: Clinic): Clinic => ({
    id,
    displayName,
    path,
})

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
        clinics: organisationUnits.map(toClinic),
        hasMore:
            pager !== undefined && pager.page * pager.pageSize < pager.total,
    }))

export const ByIdSchema = z
    .object({ organisationUnits: z.array(ClinicSchema) })
    .transform(({ organisationUnits }) => organisationUnits.map(toClinic))
