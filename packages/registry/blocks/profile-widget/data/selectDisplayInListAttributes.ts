import type { TrackedEntityAttributeField } from '../types'

/**
 * The default rows (decisions 1 and 5): program attributes whose program-level
 * `displayInList` is true, in program order, then TET-only attributes whose TET
 * `displayInList` is true, in TET order. Empty values stay as empty rows.
 *
 * `data.attributes` is already in that order (program attributes first, then
 * TET-only ones) and each `displayInList` already holds the right level's
 * flag, so the default is a plain filter you can build on.
 */
export const selectDisplayInListAttributes = (
    attributes: readonly TrackedEntityAttributeField[]
): readonly TrackedEntityAttributeField[] =>
    attributes.filter((attribute) => attribute.displayInList)
