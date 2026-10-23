import type {
    DisplayAttribute,
    DisplayAttributesOptions,
    TrackedEntityRecord,
} from './types'

/**
 * Spec 9.3, the same rule as Capture and the Finder's result rows. With a
 * program the person is enrolled in: that program's attributes in program
 * order, with its own `displayInList`. Otherwise the tracked entity type's.
 * An attribute with no value is still listed unless `onlyDisplayInList`
 * filters it out.
 */
export const displayAttributes = (
    record: TrackedEntityRecord,
    programId?: string,
    options: DisplayAttributesOptions = {}
): DisplayAttribute[] => {
    const program =
        programId === undefined ? undefined : record.programs.get(programId)
    const attributes =
        program?.status === 'enrolled'
            ? program.program.attributes
            : record.person.trackedEntityType.attributes
    return attributes
        .filter(
            ({ displayInList }) => !options.onlyDisplayInList || displayInList
        )
        .map((attribute) => ({
            attribute,
            value: record.person.attributes.get(attribute.id),
        }))
}
