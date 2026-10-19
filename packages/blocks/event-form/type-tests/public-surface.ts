import type { EventFormApiError } from '../src/api/client'
import {
    useStageMetadata,
    useSystemCalendar,
    useTrackerEvent,
} from '../src/api/hooks'
import { eventFormKeys } from '../src/api/queries'
import type {
    DataElementMeta,
    Section,
    StageMetadata,
    SystemCalendar,
    TrackerEvent,
} from '../src/api/schemas'

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
        ? true
        : false
const assert = <T extends true>(): T | undefined => undefined

declare const metadata: StageMetadata
export const stageId: string = metadata.stage.id
export const sections: Section[] = metadata.stage.sections
export const element: DataElementMeta | undefined =
    metadata.dataElements.get('de0FEHSIoxh')
export const validationStrategy:
    | 'NONE'
    | 'ON_COMPLETE'
    | 'ON_UPDATE_AND_INSERT' = metadata.stage.validationStrategy
export const featureType: 'NONE' | 'POINT' | 'POLYGON' =
    metadata.stage.featureType
export const hasCategoryCombo: boolean = metadata.hasCategoryCombo

declare const event: TrackerEvent
export const status:
    | 'ACTIVE'
    | 'COMPLETED'
    | 'SCHEDULE'
    | 'OVERDUE'
    | 'SKIPPED'
    | 'VISITED' = event.status
export const firstValue: { dataElement: string; value: string } | undefined =
    event.dataValues[0]
export const noteText: string | undefined = event.notes[0]?.value
// @ts-expect-error A tracker event holds occurredAt, not the legacy eventDate.
export const legacyEventDate = event.eventDate

declare const calendar: SystemCalendar
export const dateFormat: 'YYYY-MM-DD' | 'DD-MM-YYYY' = calendar.dateFormat

export const keys = [
    eventFormKeys.stage('program00001', 'stage000001'),
    eventFormKeys.event('event000001'),
    eventFormKeys.systemInfo(),
]

export const stageQuery = useStageMetadata('program00001', 'stage000001')
export const eventQuery = useTrackerEvent(undefined)
export const calendarQuery = useSystemCalendar()
export const queryErrorIsTyped =
    assert<Equal<typeof stageQuery.error, EventFormApiError | null>>()
