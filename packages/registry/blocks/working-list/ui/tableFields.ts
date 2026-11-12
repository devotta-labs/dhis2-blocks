import type { TrackerProgram } from '../api/schemas'
import type { WorkingListField } from '../domain/model'
import type { WorkingListConfiguration } from '../provider/contracts'

/** The fields a table may show as columns in the configuration's mode and stage. */
export const tableFieldsFor = (
    fields: readonly WorkingListField[],
    program: TrackerProgram,
    configuration: WorkingListConfiguration
) => {
    const currentStage =
        configuration.mode === 'event'
            ? program.programStages.find(
                  (stage) => stage.id === configuration.programStageId
              )
            : undefined
    const stageDataElementIds = new Set(
        currentStage?.programStageDataElements.map(
            (binding) => binding.dataElement.id
        ) ?? []
    )
    return fields.filter((field) => {
        if (field.columnable === false) {
            return false
        }
        if (field.source === 'trackedEntityAttribute') {
            return true
        }
        if (field.source === 'eventDataElement') {
            return (
                configuration.mode === 'event' &&
                stageDataElementIds.has(field.id)
            )
        }
        if (['createdAt', 'programOwnerId'].includes(field.id)) {
            return true
        }
        return (
            configuration.mode === 'event' &&
            [
                'eventStatus',
                'eventOccurredAt',
                'eventScheduledAt',
                'eventOrgUnit',
                'eventAssignedUser',
            ].includes(field.id)
        )
    })
}
