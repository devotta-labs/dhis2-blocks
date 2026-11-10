import type { z } from 'zod'
import type { Field } from '@/components/dhis2-value-types'
import type { dataElementSchema } from './eventSchemas'

/** The grid's field for a data element or attribute: its value type, mask and options. */
export const fieldOf = ({
    valueType,
    fieldMask,
    optionSet,
}: Pick<
    z.infer<typeof dataElementSchema>,
    'valueType' | 'fieldMask' | 'optionSet'
>): Field => ({
    valueType,
    fieldMask,
    options: optionSet?.options.map(({ code, displayName }) => ({
        code,
        name: displayName,
    })),
})
