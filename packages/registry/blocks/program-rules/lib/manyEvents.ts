import i18n from '@dhis2/d2-i18n'
import { Result } from 'better-result'
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
    /** Whether `persons` were fetched for the rows: then a tracker row whose person is missing fails instead of running. */
    personsLoaded: boolean
}

/** What `evaluateEventsRules` returns: each evaluated row is in exactly one of the maps. */
export interface EventsRulesEvaluation {
    /** rowId → the row's effects */
    effects: Map<string, RuleEffects>
    /** rowId → why the engine could not run the row's rules */
    failures: Map<string, Error>
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

interface RowIndex {
    byId: Map<string, EventsRuleRow>
    byPerson: Map<string, EventsRuleRow[]>
}

const rowIndexes = new WeakMap<ReadonlyArray<EventsRuleRow>, RowIndex>()

/** The rows by id and by person, built once per array: a grid evaluates one row at a time over the same rows. */
export const indexRows = (rows: ReadonlyArray<EventsRuleRow>): RowIndex => {
    const cached = rowIndexes.get(rows)
    if (cached !== undefined) {
        return cached
    }
    const byPerson = new Map<string, EventsRuleRow[]>()
    for (const row of rows) {
        if (row.enrollmentId !== undefined) {
            const same = byPerson.get(row.enrollmentId) ?? []
            same.push(row)
            byPerson.set(row.enrollmentId, same)
        }
    }
    const index = {
        byId: new Map(rows.map((row) => [row.event.id, row])),
        byPerson,
    }
    rowIndexes.set(rows, index)
    return index
}

/**
 * Runs the rules of the requested rows against the grid's live values, each row on its own: a row the engine fails on,
 * or a tracker row whose fetched person is missing, is in `failures`, and the other rows still get their effects.
 * `contexts` is keyed by program stage id; a row of a stage without a context, or an id that is not in `input.rows`, is
 * in neither map. `input.rows` is indexed once per array: pass a new array when the rows change.
 */
export const evaluateEventsRules = (
    engine: RuleEngineModule,
    contexts: ReadonlyMap<string, RuleContext>,
    input: EventsRuleInput,
    rowIds: ReadonlyArray<string>
): EventsRulesEvaluation => {
    const { byId: rows, byPerson: rowsOfPerson } = indexRows(input.rows)
    const effects = new Map<string, RuleEffects>()
    const failures = new Map<string, Error>()
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
        // Without its person an ASSIGN that reads attributes assigns nothing, which would clear the row's values.
        if (
            input.tracker &&
            input.personsLoaded &&
            enrollmentId !== undefined &&
            person === undefined
        ) {
            failures.set(
                rowId,
                new Error(
                    i18n.t('The enrollment of this event could not be read')
                )
            )
            continue
        }
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
        const evaluation = Result.try({
            try: () => evaluateEventRules(engine, context, ruleInput),
            catch: (cause) =>
                cause instanceof Error ? cause : new Error(String(cause)),
        })
        if (evaluation.isOk()) {
            effects.set(rowId, evaluation.value)
        } else {
            failures.set(rowId, evaluation.error)
        }
    }
    return { effects, failures }
}
