import type { ValueMeta } from '@/components/dhis2-value-display/formatDhis2Value'
import type { ProgramTimelineMetadata } from './schemas'
import type { FieldInfo, ProgramInfo, StageInfo } from './types'

const fieldInfo = (source: {
    displayName: string
    displayFormName?: string
    valueType: string
    optionSet?: ValueMeta['optionSet']
}): FieldInfo => ({
    name: source.displayFormName ?? source.displayName,
    meta: { valueType: source.valueType, optionSet: source.optionSet },
})

/** The program's stages, data elements and attributes, keyed by id. */
export const toProgramInfo = (
    metadata: ProgramTimelineMetadata
): ProgramInfo => ({
    id: metadata.id,
    name: metadata.displayName,
    enrollmentDateLabel: metadata.displayEnrollmentDateLabel,
    incidentDateLabel: metadata.displayIncidentDateLabel,
    stages: new Map(
        metadata.programStages.map((stage): [string, StageInfo] => [
            stage.id,
            {
                id: stage.id,
                name: stage.displayName,
                hideDueDate: stage.hideDueDate,
                reportDataElementIds: stage.programStageDataElements
                    .filter((element) => element.displayInReports)
                    .map((element) => element.dataElement.id),
                dataElements: new Map(
                    stage.programStageDataElements.map(({ dataElement }) => [
                        dataElement.id,
                        fieldInfo(dataElement),
                    ])
                ),
            },
        ])
    ),
    attributes: new Map(
        metadata.programTrackedEntityAttributes.map(
            ({ trackedEntityAttribute }) => [
                trackedEntityAttribute.id,
                fieldInfo(trackedEntityAttribute),
            ]
        )
    ),
})

/** Every program's attributes in one map; the type's attributes repeat across programs. */
export const attributesOf = (
    programs: Iterable<ProgramInfo>
): ReadonlyMap<string, FieldInfo> => {
    const attributes = new Map<string, FieldInfo>()
    for (const program of programs) {
        for (const [id, info] of program.attributes) {
            attributes.set(id, info)
        }
    }
    return attributes
}
