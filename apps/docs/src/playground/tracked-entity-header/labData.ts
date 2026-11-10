import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { LabNetwork } from '../network'
import { generateLabData as generateObservationData } from '../observation-cards/labData'
import { DEFAULT_SETTINGS as OBSERVATION_DEFAULTS } from '../observation-cards/presets'

import { LAB_PERSON } from '../observation-cards/labData'
import { specOf } from './labAttributes'
import { SUBJECTS } from './labSubjects'

// Everyone in the lab is the observation cards lab's one person, so the pregnancy person has visits to show.
export { LAB_PERSON }

type LabRecord =
    | 'child'
    | 'pregnancy'
    | 'adult'
    | 'long'
    | 'empty'
    | 'broken'
    | 'amharic'
    | 'arabic'
    | 'detailed'
    | 'shipment'

export interface LabSettings {
    record: LabRecord
    inactive: boolean
    potentialDuplicate: boolean
    /** The server refuses the person with a 403. */
    restricted: boolean
    /** Enrolled in the program, not enrolled (DHIS2 answers 404), or enrolled again after completing. */
    enrollment: 'enrolled' | 'none' | 'again'
    calendar: Dhis2Calendar
    /** The default banner, or the parts composed by hand. */
    arrangement: 'default' | 'composed'
    width: 'narrow' | 'wide'
    /** The host's buttons: one, or several. */
    actions: 'one' | 'several'
    /** Line one as composed, or with more of the attributes placed on it. */
    lineOne: 'usual' | 'more'
    /** The canvas laid out right to left. */
    rtl: boolean
    network: LabNetwork
}

const ORG_UNIT = 'labOrgUnit1'

const isoToday = () => new Date().toLocaleDateString('sv')

const daysAgo = (today: string, days: number) => {
    const date = new Date(`${today}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - days)
    return `${date.toISOString().slice(0, 10)}T12:00:00.000`
}

const attributeJson = (id: string) => {
    const { label, valueType, options, broken } = specOf(id)
    return {
        id,
        displayFormName: label,
        valueType,
        ...(options && {
            optionSet: {
                options: options.map(([code, displayName]) =>
                    broken ? { code } : { code, displayName }
                ),
            },
        }),
    }
}

/** Everything the lab's DHIS2 holds for its one person, as the block's requests see it. */
export const generateLabData = (settings: LabSettings, today = isoToday()) => {
    const subject = SUBJECTS[settings.record]
    // Enrolled again: the current enrollment is the open one.
    const enrollment =
        settings.enrollment === 'again'
            ? {
                  status: 'ACTIVE' as const,
                  enrolledDaysAgo: 20,
                  occurredDaysAgo: 20,
              }
            : subject.enrollment
    const recordJson = (withProgram: boolean) => ({
        trackedEntity: LAB_PERSON,
        trackedEntityType: subject.type,
        orgUnit: ORG_UNIT,
        inactive: settings.inactive,
        potentialDuplicate: settings.potentialDuplicate,
        attributes: subject.attributes
            .filter(
                (id, index) =>
                    id in subject.values && (withProgram || index < 3)
            )
            .map((id) => ({
                attribute: id,
                displayName: specOf(id).label,
                valueType: specOf(id).valueType,
                value: subject.values[id],
            })),
        enrollments: withProgram
            ? [
                  // Completed years ago; the block shows the active one.
                  ...(settings.enrollment === 'again'
                      ? [
                            {
                                enrollment: 'labEnrolmnt0',
                                program: subject.program,
                                status: 'COMPLETED',
                                orgUnit: ORG_UNIT,
                                enrolledAt: daysAgo(today, 900),
                                occurredAt: daysAgo(today, 900),
                                completedAt: daysAgo(today, 600),
                                followUp: false,
                            },
                        ]
                      : []),
                  {
                      enrollment: 'labEnrolmnt1',
                      program: subject.program,
                      status: enrollment.status,
                      orgUnit: ORG_UNIT,
                      enrolledAt: daysAgo(today, enrollment.enrolledDaysAgo),
                      occurredAt: daysAgo(today, enrollment.occurredDaysAgo),
                      ...('completedDaysAgo' in enrollment &&
                          enrollment.completedDaysAgo !== undefined && {
                              completedAt: daysAgo(
                                  today,
                                  enrollment.completedDaysAgo
                              ),
                          }),
                      followUp: false,
                  },
              ]
            : [],
        programOwners: withProgram
            ? [{ orgUnit: ORG_UNIT, program: subject.program }]
            : [],
    })
    const listed = (ids: string[]) =>
        ids.map((id, index) => ({
            displayInList: specOf(id).displayInList,
            sortOrder: index + 1,
            trackedEntityAttribute: attributeJson(id),
        }))
    const observations = generateObservationData(
        { ...OBSERVATION_DEFAULTS, calendar: settings.calendar },
        today
    )
    return {
        record: { withProgram: recordJson(true), without: recordJson(false) },
        program: {
            displayName: subject.programName,
            accessLevel: 'PROTECTED',
            ...(subject.incidentDateLabel && {
                incidentDateLabel: subject.incidentDateLabel,
            }),
            enrollmentDateLabel: 'Date of enrollment',
            trackedEntityType: { displayName: subject.typeName },
            programTrackedEntityAttributes: listed(subject.attributes),
            // The observation cards' stages and data elements, for the facts line.
            ...(settings.record === 'pregnancy' && {
                programStages: observations.program.programStages,
            }),
        },
        type: {
            displayName: subject.typeName,
            trackedEntityTypeAttributes: listed(
                subject.attributes.slice(0, 3)
            ).map(({ displayInList, trackedEntityAttribute }) => ({
                displayInList,
                trackedEntityAttribute,
            })),
        },
        observations,
        systemInfo: observations.systemInfo,
    }
}

export type LabData = ReturnType<typeof generateLabData>
