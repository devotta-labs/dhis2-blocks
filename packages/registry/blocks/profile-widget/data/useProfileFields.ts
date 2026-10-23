import { useMemo } from 'react'
import type { ProfileFieldInput, UseProfileFieldsResult } from '../types'
import type { FormattableField } from './formatting/contracts'
import { useFormattedFields } from './formatting/useFormattedFields'
import { decodeValueType } from './formatting/valueTypes'

const toFormattableField = (input: ProfileFieldInput): FormattableField => ({
    id: input.id,
    label: input.label,
    valueType: decodeValueType(input.valueType),
    rawValue: input.value,
    options: input.options,
    file: input.fileEndpoint ? { endpoint: input.fileEndpoint } : undefined,
})

export function useProfileFields(
    inputs: readonly ProfileFieldInput[] | undefined
): UseProfileFieldsResult {
    const fields = useMemo(() => inputs?.map(toFormattableField), [inputs])
    const { data, error, isPending } = useFormattedFields(fields)

    return { data, error, isPending }
}
