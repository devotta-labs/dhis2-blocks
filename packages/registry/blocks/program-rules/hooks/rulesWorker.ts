import * as engine from '@dhis2/rule-engine'
import { Result } from 'better-result'
import { buildRuleContext } from '../lib/buildContext'
import { evaluateEventsRules } from '../lib/manyEvents'
import { metadataForStage } from '../lib/stages'
import type { RuleContext, RuleEffects, RuleEnrollmentData } from '../lib/types'
import type {
    RulesWorkerReply,
    RulesWorkerRequest,
    RulesWorkerSetup,
} from './backgroundRules'

// The rule engine off the main thread: `backgroundRules` posts each grid's rules and people once, then rows, and gets
// their effects back. It holds its own copy of the engine and builds its own contexts, as neither can be posted.

interface Setup {
    contexts: Map<string, RuleContext>
    persons: Map<string, RuleEnrollmentData>
    tracker: boolean
    personsLoaded: boolean
}

const setups = new Map<number, Setup>()

const build = ({
    metadata,
    stageIds,
    orgUnitGroups,
    persons,
    tracker,
    personsLoaded,
}: RulesWorkerSetup): Setup => ({
    contexts: new Map(
        stageIds.map((stageId): [string, RuleContext] => {
            const forStage = metadataForStage(metadata, stageId)
            return [
                stageId,
                buildRuleContext(
                    engine,
                    orgUnitGroups === undefined
                        ? forStage
                        : { ...forStage, orgUnitGroups }
                ),
            ]
        })
    ),
    persons: new Map(persons),
    tracker,
    personsLoaded,
})

/** The first of `rowIds` it gets to in `forMs`, a row at least, each evaluated as `evaluateEventsRules` does. */
const evaluate = (
    setup: Setup,
    { rows, rowIds, forMs }: Extract<RulesWorkerRequest, { type: 'evaluate' }>
) => {
    const input = {
        rows,
        persons: setup.persons,
        tracker: setup.tracker,
        personsLoaded: setup.personsLoaded,
    }
    const effects = new Map<string, RuleEffects>()
    const failures = new Map<string, Error>()
    const until = performance.now() + forMs
    let done = 0
    while (done < rowIds.length && (done === 0 || performance.now() < until)) {
        const one = evaluateEventsRules(engine, setup.contexts, input, [
            rowIds[done],
        ])
        done += 1
        for (const [rowId, found] of one.effects) {
            effects.set(rowId, found)
        }
        // Only an error's message is read, and an engine's error may hold what cannot be posted.
        for (const [rowId, { message }] of one.failures) {
            failures.set(rowId, new Error(message))
        }
    }
    return { evaluation: { effects, failures }, done }
}

const answer = (message: RulesWorkerRequest): RulesWorkerReply | undefined => {
    switch (message.type) {
        case 'setup': {
            const built = Result.try(() => build(message))
            if (built.isOk()) {
                setups.set(message.setup, built.value)
            }
            return { setup: message.setup, ready: built.isOk() }
        }
        case 'release':
            setups.delete(message.setup)
            return undefined
        case 'evaluate': {
            const setup = setups.get(message.setup)
            const evaluated =
                setup === undefined
                    ? undefined
                    : Result.try(() => evaluate(setup, message))
            return evaluated?.isOk()
                ? { request: message.request, ...evaluated.value }
                : { request: message.request }
        }
    }
}

self.addEventListener(
    'message',
    ({ data }: MessageEvent<RulesWorkerRequest>) => {
        const reply = answer(data)
        if (reply !== undefined) {
            self.postMessage(reply)
        }
    }
)
