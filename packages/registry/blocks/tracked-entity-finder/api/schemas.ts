import { z } from 'zod'

export interface AttributeMetadata {
    id: string
    label: string
    valueType: string
    unique: boolean
    searchable: boolean
    displayInList: boolean
    options?: { code: string; name: string }[]
    preferredSearchOperator?: string
    blockedSearchOperators: string[]
    minCharactersToSearch: number
}

export interface ProgramMetadata {
    program: string
    name: string
    trackedEntityType: string
    minAttributesRequiredToSearch: number
    maxTeiCountToReturn: number
    /** Ordered by sortOrder, then response order. */
    attributes: AttributeMetadata[]
}

/** DHIS2's default when a program does not configure a minimum. */
const DEFAULT_MIN_ATTRIBUTES_REQUIRED_TO_SEARCH = 1
/** 0 means the server applies no limit. */
const DEFAULT_MAX_TEI_COUNT_TO_RETURN = 0

const AttributeSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    displayFormName: z.string().nullish(),
    valueType: z.string(),
    unique: z.boolean().default(false),
    optionSet: z
        .object({
            id: z.string().optional(),
            options: z
                .array(z.object({ code: z.string(), displayName: z.string() }))
                .default([]),
        })
        .nullish(),
    preferredSearchOperator: z.string().nullish(),
    blockedSearchOperators: z.array(z.string()).nullish(),
    minCharactersToSearch: z.number().nullish(),
})

const LinkSchema = z.object({
    searchable: z.boolean().default(false),
    displayInList: z.boolean().default(false),
    sortOrder: z.number().nullish(),
    trackedEntityAttribute: AttributeSchema,
})

export const ProgramResponseSchema = z.object({
    displayName: z.string(),
    minAttributesRequiredToSearch: z.number().nullish(),
    maxTeiCountToReturn: z.number().nullish(),
    trackedEntityType: z.object({ id: z.string() }),
    programTrackedEntityAttributes: z.array(LinkSchema),
})

type AttributeLink = z.infer<typeof LinkSchema>

const toAttributeMetadata = (link: AttributeLink): AttributeMetadata => {
    const attribute = link.trackedEntityAttribute
    const meta: AttributeMetadata = {
        id: attribute.id,
        label: attribute.displayFormName ?? attribute.displayName,
        valueType: attribute.valueType,
        unique: attribute.unique,
        searchable: link.searchable,
        displayInList: link.displayInList,
        blockedSearchOperators: (attribute.blockedSearchOperators ?? []).map(
            (operator) => operator.toLowerCase()
        ),
        minCharactersToSearch: attribute.minCharactersToSearch ?? 0,
    }
    if (attribute.optionSet) {
        meta.options = attribute.optionSet.options.map((option) => ({
            code: option.code,
            name: option.displayName,
        }))
    }
    if (attribute.preferredSearchOperator) {
        meta.preferredSearchOperator =
            attribute.preferredSearchOperator.toLowerCase()
    }
    return meta
}

export const normaliseProgram = (
    program: string,
    response: z.infer<typeof ProgramResponseSchema>
): ProgramMetadata => ({
    program,
    name: response.displayName,
    trackedEntityType: response.trackedEntityType.id,
    minAttributesRequiredToSearch:
        response.minAttributesRequiredToSearch ??
        DEFAULT_MIN_ATTRIBUTES_REQUIRED_TO_SEARCH,
    maxTeiCountToReturn:
        response.maxTeiCountToReturn ?? DEFAULT_MAX_TEI_COUNT_TO_RETURN,
    attributes: response.programTrackedEntityAttributes
        .map((link, index) => ({ link, index }))
        .sort(
            (a, b) =>
                (a.link.sortOrder ?? Number.MAX_SAFE_INTEGER) -
                    (b.link.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
                a.index - b.index
        )
        .map(({ link }) => toAttributeMetadata(link)),
})

const AttributeValueSchema = z.object({
    attribute: z.string(),
    value: z
        .union([z.string(), z.number(), z.boolean()])
        .nullish()
        .transform((value) => (value == null ? '' : String(value))),
})

const TrackedEntityRowSchema = z.object({
    trackedEntity: z.string(),
    trackedEntityType: z.string(),
    orgUnit: z.string(),
    programOwners: z
        .array(z.object({ orgUnit: z.string(), program: z.string() }))
        .default([]),
    attributes: z.array(AttributeValueSchema).default([]),
})

export type RawTrackedEntity = z.infer<typeof TrackedEntityRowSchema>

const PagerSchema = z.object({
    page: z.number().optional(),
    pageSize: z.number().optional(),
    total: z.number().optional(),
})

/**
 * Accepts `trackedEntities` or the legacy `instances`, and the pager under
 * `pager` or at the top level.
 */
export const TrackedEntitiesResponseSchema = z
    .object({
        trackedEntities: z.array(TrackedEntityRowSchema).optional(),
        instances: z.array(TrackedEntityRowSchema).optional(),
        pager: PagerSchema.optional(),
        total: z.number().optional(),
    })
    .loose()

export type TrackedEntitiesResponse = z.infer<
    typeof TrackedEntitiesResponseSchema
>

export const normaliseTrackedEntities = (
    response: TrackedEntitiesResponse
): { rows: RawTrackedEntity[]; total?: number } => {
    const rows = response.trackedEntities ?? response.instances ?? []
    const total = response.pager?.total ?? response.total
    return total === undefined ? { rows } : { rows, total }
}
