import { z } from 'zod'

export type CanonicalValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | CanonicalValue[]
    | { [key: string]: CanonicalValue }

export const CanonicalValueSchema: z.ZodType<CanonicalValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.undefined(),
        z.array(CanonicalValueSchema),
        z.record(z.string(), CanonicalValueSchema),
    ])
)

const CanonicalRecordSchema = z.record(z.string(), CanonicalValueSchema)

/** Recursively sorts object keys and omits undefined object properties. */
export const canonicalizeValue = (value: CanonicalValue): CanonicalValue => {
    if (Array.isArray(value)) {
        return value.map(canonicalizeValue)
    }
    const record = CanonicalRecordSchema.safeParse(value)
    if (!record.success) {
        return value
    }
    return Object.fromEntries(
        Object.entries(record.data)
            .filter(([, entry]) => entry !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => [key, canonicalizeValue(entry)])
    )
}
