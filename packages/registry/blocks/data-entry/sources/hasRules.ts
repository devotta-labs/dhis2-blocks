import { ruleIdSchema } from './eventSchemas'
import type { DataEngine } from './types'

/**
 * Whether the program has any rules, from the id of one of them. A request that fails, or an answer that is not
 * understood, says no: the form still opens, and the rules hook loads the rules and reports its own failures.
 */
export const hasRulesIn = (
    engine: DataEngine,
    programId: string,
    signal?: AbortSignal
): Promise<boolean> =>
    engine
        .query(
            {
                rules: {
                    resource: 'programRules',
                    params: {
                        filter: `program.id:eq:${programId}`,
                        fields: 'id',
                        pageSize: 1,
                    },
                },
            },
            { signal }
        )
        .then(
            (answer) => ruleIdSchema.parse(answer).rules.programRules.length > 0
        )
        .catch(() => false)
