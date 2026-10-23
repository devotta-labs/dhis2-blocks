import { useMemo } from 'react'
import type { ProfileFieldInput, UseProfileFieldsResult } from '../types'
import type { FormattableField } from './formatting/contracts'
import { useFormattedFields } from './formatting/useFormattedFields'
import { decodeValueType } from './formatting/valueTypes'

/** A consumer's raw field as input to the shared formatting pipeline. */
export const toFormattableField = (
    input: ProfileFieldInput
): FormattableField => ({
    id: input.id,
    label: input.label,
    valueType: decodeValueType(input.valueType),
    rawValue: input.value,
    options: input.options,
    file: input.fileEndpoint ? { endpoint: input.fileEndpoint } : undefined,
})

/**
 * Spec 2.4. Formats any raw values (data elements, attributes from your own
 * request, …) exactly like the profile hook does. Pass undefined while your
 * own data is still loading; `isPending` stays true until it is defined and
 * every lookup it needs has resolved.
 */
export function useProfileFields(
    inputs: readonly ProfileFieldInput[] | undefined
): UseProfileFieldsResult {
    const fields = useMemo(() => inputs?.map(toFormattableField), [inputs])
    const { data, error, isPending } = useFormattedFields(fields)

    return { data, error, isPending }
}
