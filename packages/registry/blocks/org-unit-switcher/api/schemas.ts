import { z } from 'zod'

export interface OrgUnit {
    id: string
    displayName: string
    /** DHIS2's short name, at most 50 characters; the trigger shows it in place of the full name. */
    displayShortName?: string
    path: string
}

export interface AssignedOrgUnit extends OrgUnit {
    hasChildren: boolean
}

/** Unknown fields are dropped, so a unit is only these. */
const OrgUnitSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    displayShortName: z.string().optional(),
    path: z.string(),
})

const AssignedOrgUnitSchema = OrgUnitSchema.extend({
    children: z.boolean().optional(),
}).transform(({ children, ...orgUnit }): AssignedOrgUnit => ({
    ...orgUnit,
    hasChildren: children ?? false,
}))

/** A user with no assigned units may come back without the field at all. */
export const MeSchema = z
    .object({
        id: z.string(),
        organisationUnits: z.array(AssignedOrgUnitSchema).default([]),
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
        organisationUnits: z.array(OrgUnitSchema),
    })
    .transform(({ pager, organisationUnits }) => ({
        orgUnits: organisationUnits,
        hasMore:
            pager !== undefined && pager.page * pager.pageSize < pager.total,
    }))

export const ByIdSchema = z
    .object({ organisationUnits: z.array(OrgUnitSchema) })
    .transform(({ organisationUnits }) => organisationUnits)
