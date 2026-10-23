import type { TrackedEntityAttributeField } from '../types'

export const selectDisplayInListAttributes = (
    attributes: readonly TrackedEntityAttributeField[]
): readonly TrackedEntityAttributeField[] =>
    attributes.filter((attribute) => attribute.displayInList)
