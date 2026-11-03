import { z } from 'zod'
import { recordIdOf } from '../model/types'
import type { DataRecord } from '../model/types'
import type { SaveOutcome } from '../outbox/sync'
import { waitingForParent } from './trackerPayload'
import type { SentObjects } from './trackerPayload'

/** What a tracker import answers: the refused objects, by uid and tracker type. */
export const importReportSchema = z.object({
    status: z.string(),
    validationReport: z.object({
        errorReports: z.array(
            z.object({
                errorCode: z.string(),
                message: z.string(),
                trackerType: z.string().optional(),
                uid: z.string().optional(),
                args: z.array(z.string()).optional(),
            })
        ),
    }),
})

export type ImportReport = z.infer<typeof importReportSchema>

/** The record kind of a report's `trackerType`. */
const kindOf = (
    trackerType: string | undefined
): DataRecord['kind'] | undefined => {
    switch (trackerType) {
        case 'TRACKED_ENTITY':
            return 'trackedEntity'
        case 'ENROLLMENT':
            return 'enrollment'
        case 'EVENT':
            return 'event'
        default:
            return undefined
    }
}

// The DHIS2 code for an object not created because the person or enrolment it belongs to was not.
const PARENT_REFUSED = 'E5000'

export type Outcome = Pick<SaveOutcome, 'sourceKey' | 'key'>

const fieldOfKey = (key: string) => key.slice(key.indexOf('.') + 1)

/**
 * Records of an object the report names are refused with its messages: a new object's wait, so they are sent
 * again together once a cell is corrected; an existing object's fail. A report is matched by uid and kind (one
 * without a kind by uid alone); a report without a uid fails none. A person's refusal that names some of its changed
 * attributes is on those cells alone, and its other cells wait for the person to be saved. A new enrolment or event that DHIS2 did not create
 * because the person or enrolment it belongs to was refused in the same import (E5000, or on 2.41 and 2.42 no report
 * at all) waits for that person or enrolment. When the import was refused as a whole (status ERROR) nothing was
 * saved, so the other records get no outcome.
 */
export const outcomesFromReport = (
    records: ReadonlyArray<Outcome>,
    report: ImportReport,
    created: ReadonlySet<string>,
    objects: SentObjects = new Map()
): SaveOutcome[] => {
    const refusals = new Map<
        string,
        Array<{
            errorCode: string
            message: string
            args: ReadonlyArray<string>
            kind?: DataRecord['kind']
        }>
    >()
    for (const { uid, errorCode, message, args = [], trackerType } of report
        .validationReport.errorReports) {
        if (uid !== undefined) {
            refusals.set(uid, [
                ...(refusals.get(uid) ?? []),
                { errorCode, message, args, kind: kindOf(trackerType) },
            ])
        }
    }
    const fieldsOf = new Map<string, string[]>()
    for (const { key } of records) {
        const id = recordIdOf(key)
        fieldsOf.set(id, [...(fieldsOf.get(id) ?? []), fieldOfKey(key)])
    }
    // DHIS2 names an attribute in backticks (E1064) or in its arguments (E1018's `identifier=<uid>`).
    const names = (
        refusal: { message: string; args: ReadonlyArray<string> },
        field: string
    ) =>
        refusal.message.includes(`\`${field}\``) ||
        refusal.args.some((arg) => arg.includes(field))
    const refusalsOf = (id: string) => {
        const kind = objects.get(id)?.kind
        return (refusals.get(id) ?? []).filter(
            (refusal) =>
                refusal.kind === undefined ||
                kind === undefined ||
                refusal.kind === kind
        )
    }
    /** The person, else the enrolment, a created object belongs to that DHIS2 refused. */
    const refusedParent = (id: string) => {
        let refused: DataRecord['kind'] | undefined
        for (
            let parent = objects.get(id)?.parent;
            parent !== undefined;
            parent = objects.get(parent)?.parent
        ) {
            if (refusalsOf(parent).length > 0) {
                refused = objects.get(parent)?.kind ?? refused
            }
        }
        return refused
    }
    return records.flatMap(({ sourceKey, key }): SaveOutcome[] => {
        const id = recordIdOf(key)
        const own = refusalsOf(id)
        const parent =
            created.has(id) &&
            own.every(({ errorCode }) => errorCode === PARENT_REFUSED)
                ? refusedParent(id)
                : undefined
        if (parent !== undefined) {
            return [
                {
                    sourceKey,
                    key,
                    result: 'waiting',
                    reason: waitingForParent(parent),
                },
            ]
        }
        // A person's refusal that names some of its changed attributes is theirs; its other cells wait for the person.
        const namesAttribute =
            objects.get(id)?.kind === 'trackedEntity' &&
            (fieldsOf.get(id) ?? []).some((field) =>
                own.some((refusal) => names(refusal, field))
            )
        if (namesAttribute) {
            const mine = own.filter((refusal) =>
                names(refusal, fieldOfKey(key))
            )
            return [
                mine.length > 0
                    ? {
                          sourceKey,
                          key,
                          result: created.has(id) ? 'waiting' : 'failed',
                          reason: mine.map(({ message }) => message).join('; '),
                      }
                    : {
                          sourceKey,
                          key,
                          result: 'waiting',
                          reason: waitingForParent('trackedEntity'),
                      },
            ]
        }
        if (own.length > 0) {
            return [
                {
                    sourceKey,
                    key,
                    result: created.has(id) ? 'waiting' : 'failed',
                    reason: own.map(({ message }) => message).join('; '),
                },
            ]
        }
        return report.status === 'ERROR'
            ? []
            : [{ sourceKey, key, result: 'saved' }]
    })
}
