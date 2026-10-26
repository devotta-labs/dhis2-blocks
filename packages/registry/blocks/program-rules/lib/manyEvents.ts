import { evaluateEventRules } from './evaluate'
import type {
    EventRuleInput,
    ProgramRulesMetadata,
    RuleContext,
    RuleEffects,
    RuleEngineModule,
    RuleEnrollmentData,
    RuleEventInput,
} from './types'

/** One grid row: an event with the grid's live values, empty values left out. */
export interface EventsRuleRow {
    event: RuleEventInput
    /**
     * The person the row belongs to. Set only for rows of a tracker program: event-program events share a hidden
     * enrollment and must never couple.
     */
    enrollmentId?: string
}

export interface EventsRuleInput {
    rows: ReadonlyArray<EventsRuleRow>
    /** enrollmentId → the enrollment and events as the server has them */
    persons: ReadonlyMap<string, RuleEnrollmentData>
    /** Whether a row sees its person's other events. `false` for an event program. */
    tracker: boolean
}

/** The variable source types that read a value from another event. */
const CROSS_EVENT_SOURCES = new Set([
    'DATAELEMENT_NEWEST_EVENT_PROGRAM',
    'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE',
    'DATAELEMENT_PREVIOUS_EVENT',
])

/** The data elements whose value in one event can change the rules of the person's other events. */
export const crossEventFields = (
    metadata: ProgramRulesMetadata
): ReadonlySet<string> =>
    new Set(
        metadata.variables.flatMap((variable) =>
            variable.dataElementId !== undefined &&
            CROSS_EVENT_SOURCES.has(variable.sourceType)
                ? [variable.dataElementId]
                : []
        )
    )

/** The rows to re-run after a field changed: the row itself first, then, for a cross-event field, its person's other rows. */
export const rowsAffectedBy = (
    rows: ReadonlyArray<EventsRuleRow>,
    crossFields: ReadonlySet<string>,
    rowId: string,
    fieldId: string
): string[] => {
    const enrollmentId = rows.find((r) => r.event.id === rowId)?.enrollmentId
    if (enrollmentId === undefined || !crossFields.has(fieldId)) {
        return [rowId]
    }
    return [
        rowId,
        ...rows
            .filter(
                (r) => r.enrollmentId === enrollmentId && r.event.id !== rowId
            )
            .map((r) => r.event.id),
    ]
}

/** The row's person's server events, each replaced by its live row, plus the live rows the server lacks. Never the row itself. */
const otherEventsOf = (
    row: EventsRuleRow,
    person: RuleEnrollmentData | undefined,
    siblings: ReadonlyArray<EventsRuleRow>
): RuleEventInput[] => {
    const live = new Map(
        siblings
            .filter((s) => s.event.id !== row.event.id)
            .map((s) => [s.event.id, s.event])
    )
    const server = (person?.events ?? []).filter((e) => e.id !== row.event.id)
    const serverIds = new Set(server.map((e) => e.id))
    return [
        ...server.map((e) => live.get(e.id) ?? e),
        ...[...live.values()].filter((e) => !serverIds.has(e.id)),
    ]
}

const rowsByPerson = (
    rows: ReadonlyArray<EventsRuleRow>
): Map<string, EventsRuleRow[]> => {
    const byPerson = new Map<string, EventsRuleRow[]>()
    for (const row of rows) {
        if (row.enrollmentId !== undefined) {
            const same = byPerson.get(row.enrollmentId) ?? []
            same.push(row)
            byPerson.set(row.enrollmentId, same)
        }
    }
    return byPerson
}

/**
 * Runs the rules of the requested rows against the grid's live values. `contexts` is keyed by program stage id; a row
 * of a stage without a context, or an id that is not in `input.rows`, gets no entry. Pure.
 */
export const evaluateEventsRules = (
    engine: RuleEngineModule,
    contexts: ReadonlyMap<string, RuleContext>,
    input: EventsRuleInput,
    rowIds: ReadonlyArray<string>
): Map<string, RuleEffects> => {
    const rows = new Map(input.rows.map((row) => [row.event.id, row]))
    const rowsOfPerson = input.tracker
        ? rowsByPerson(input.rows)
        : new Map<string, EventsRuleRow[]>()
    const results = new Map<string, RuleEffects>()
    for (const rowId of rowIds) {
        const row = rows.get(rowId)
        const context =
            row === undefined
                ? undefined
                : contexts.get(row.event.programStageId)
        if (row === undefined || context === undefined) {
            continue
        }
        const enrollmentId = row.enrollmentId
        const person =
            enrollmentId === undefined
                ? undefined
                : input.persons.get(enrollmentId)
        const siblings =
            enrollmentId === undefined
                ? []
                : (rowsOfPerson.get(enrollmentId) ?? [])
        const ruleInput: EventRuleInput = input.tracker
            ? {
                  event: row.event,
                  enrollment: person?.enrollment,
                  otherEvents: otherEventsOf(row, person, siblings),
              }
            : { event: row.event, otherEvents: [] }
        results.set(rowId, evaluateEventRules(engine, context, ruleInput))
    }
    return results
}
