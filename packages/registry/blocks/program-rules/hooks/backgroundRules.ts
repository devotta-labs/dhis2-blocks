import { Result } from 'better-result'
import { indexRows, lacksPerson } from '../lib/manyEvents'
import type { EventsRuleRow, EventsRulesEvaluation } from '../lib/manyEvents'
import type {
    ProgramRulesMetadata,
    RuleContext,
    RuleEnrollmentData,
    RuleOrgUnitGroupMetadata,
} from '../lib/types'

/** What the worker builds a grid's rules from: all of it can be posted. */
export interface RulesWorkerSetup {
    metadata: ProgramRulesMetadata
    stageIds: ReadonlyArray<string>
    orgUnitGroups?: ReadonlyArray<RuleOrgUnitGroupMetadata>
    persons: ReadonlyArray<[string, RuleEnrollmentData]>
    tracker: boolean
    personsLoaded: boolean
}

export type RulesWorkerRequest =
    | ({ type: 'setup'; setup: number } & RulesWorkerSetup)
    | { type: 'release'; setup: number }
    | {
          type: 'evaluate'
          setup: number
          request: number
          /** The rows to evaluate and the rows they read. */
          rows: ReadonlyArray<EventsRuleRow>
          rowIds: ReadonlyArray<string>
          forMs: number
      }

/** A reply without an `evaluation` is a request the worker failed on. */
export type RulesWorkerReply =
    | { setup: number; ready: boolean }
    | { request: number; evaluation?: EventsRulesEvaluation; done?: number }

/** What the worker evaluated: the rows it got to, and how many of the leading row ids asked for that covers. */
export interface BackgroundEvaluation {
    evaluation: EventsRulesEvaluation
    done: number
}

export interface BackgroundRules {
    /** Posts the rules and people to the worker, starting it if nothing has yet. */
    open(): void
    /** Lets the worker forget them. */
    release(): void
    /**
     * `evaluate` off the main thread for the first of `rowIds` the worker gets to in `forMs`, a row at least: `done`
     * of them, in order. A row among those in neither map is one `evaluate` answers without running a rule (not in
     * `rows`, a stage not asked for, a person still loading or missing): ask `evaluate` for it. Undefined while the
     * worker is not ready, and where there is none; resolves to undefined when the worker failed: evaluate here then.
     */
    evaluate(
        rows: ReadonlyArray<EventsRuleRow>,
        rowIds: ReadonlyArray<string>,
        forMs: number
    ): Promise<BackgroundEvaluation | undefined> | undefined
}

/** Where the worker comes from: nowhere in a browser without workers. Tests replace it. */
export const rulesWorker = {
    start: (): Worker | undefined =>
        'Worker' in globalThis
            ? new Worker(new URL('./rulesWorker.ts', import.meta.url), {
                  type: 'module',
              })
            : undefined,
}

type EvaluationReply = Extract<RulesWorkerReply, { request: number }>

interface Link {
    worker: Worker
    /** Request → what to do with its reply; undefined when the worker failed. */
    asked: Map<number, (reply: EvaluationReply | undefined) => void>
    /** Setup → what to do once the worker has built it, or could not. */
    opened: Map<number, (ready: boolean) => void>
}

// One worker per app, as there is one engine: started for the first program with rules, and not again once it failed.
let link: Link | 'failed' | undefined
let lastId = 0

/** Whether the worker took the message: what cannot be posted is evaluated on the main thread. */
const post = (worker: Worker, message: RulesWorkerRequest) =>
    Result.try(() => worker.postMessage(message)).isOk()

const connect = (): Link | undefined => {
    if (link !== undefined) {
        return link === 'failed' ? undefined : link
    }
    // A content security policy can refuse the worker's script.
    const worker = Result.try(() => rulesWorker.start()).unwrapOr(undefined)
    if (worker === undefined) {
        link = 'failed'
        return undefined
    }
    const started: Link = { worker, asked: new Map(), opened: new Map() }
    const fail = () => {
        link = 'failed'
        worker.terminate()
        for (const reply of started.asked.values()) {
            reply(undefined)
        }
        for (const ready of started.opened.values()) {
            ready(false)
        }
        started.asked.clear()
        started.opened.clear()
    }
    worker.addEventListener(
        'message',
        ({ data }: MessageEvent<RulesWorkerReply>) => {
            if ('request' in data) {
                started.asked.get(data.request)?.(data)
                started.asked.delete(data.request)
            } else {
                started.opened.get(data.setup)?.(data.ready)
            }
        }
    )
    // The script did not load, or the worker threw.
    worker.addEventListener('error', fail)
    worker.addEventListener('messageerror', fail)
    link = started
    return started
}

/** Starts the worker, which loads its own engine, ahead of the first rules: call it once a program has rules. */
export const startRulesWorker = (): void => {
    connect()
}

interface BackgroundOptions extends Omit<RulesWorkerSetup, 'persons'> {
    /** The stages the main thread built a context for: a row of another stage is not evaluated. */
    contexts: ReadonlyMap<string, RuleContext>
    persons: ReadonlyMap<string, RuleEnrollmentData>
    /** Every person a loaded chunk asked for, returned or not. */
    answered: ReadonlySet<string>
}

/** One grid's rules in the worker: the same rules and people the main thread evaluates with. */
export const backgroundRules = ({
    contexts,
    persons,
    answered,
    ...setup
}: BackgroundOptions): BackgroundRules => {
    lastId += 1
    const id = lastId
    let ready = false
    const input = { persons, ...setup }
    /** Whether the row's rules run: `evaluateEventsRules` answers the others without the engine. */
    const runs = (row: EventsRuleRow | undefined): row is EventsRuleRow =>
        row !== undefined &&
        contexts.has(row.event.programStageId) &&
        (!setup.personsLoaded ||
            row.enrollmentId === undefined ||
            answered.has(row.enrollmentId)) &&
        !lacksPerson(input, row)
    return {
        open: () => {
            const to = connect()
            if (to === undefined) {
                return
            }
            to.opened.set(id, (built) => {
                ready = built
            })
            post(to.worker, {
                type: 'setup',
                setup: id,
                ...setup,
                persons: [...persons],
            })
        },
        release: () => {
            ready = false
            if (link !== undefined && link !== 'failed') {
                link.opened.delete(id)
                post(link.worker, { type: 'release', setup: id })
            }
        },
        evaluate: (rows, rowIds, forMs) => {
            if (!ready || link === undefined || link === 'failed') {
                return undefined
            }
            const { asked, worker } = link
            const { byId, byPerson } = indexRows(rows)
            // Where in `rowIds` each row sent is.
            const sentAt = rowIds.flatMap((rowId, at) =>
                runs(byId.get(rowId)) ? [at] : []
            )
            const sent = sentAt.map((at) => rowIds[at])
            if (sent.length === 0) {
                return Promise.resolve({
                    evaluation: { effects: new Map(), failures: new Map() },
                    done: rowIds.length,
                })
            }
            // A tracker row reads its person's other rows.
            const read = new Set(
                sent.flatMap((rowId) => {
                    const row = byId.get(rowId)
                    const person = setup.tracker ? row?.enrollmentId : undefined
                    return person === undefined
                        ? (row ?? [])
                        : (byPerson.get(person) ?? [])
                })
            )
            lastId += 1
            const request = lastId
            const replied = new Promise<EvaluationReply | undefined>(
                (resolve) => asked.set(request, resolve)
            )
            const posted = post(worker, {
                type: 'evaluate',
                setup: id,
                request,
                rows: [...read],
                rowIds: sent,
                forMs,
            })
            if (!posted) {
                asked.delete(request)
                return undefined
            }
            return replied.then((reply) => {
                if (reply?.evaluation === undefined) {
                    // What the worker could not evaluate once, it is not asked again.
                    ready = false
                    return undefined
                }
                return {
                    evaluation: reply.evaluation,
                    // Up to the first row sent that the worker did not get to.
                    done: sentAt[reply.done ?? sent.length] ?? rowIds.length,
                }
            })
        },
    }
}
