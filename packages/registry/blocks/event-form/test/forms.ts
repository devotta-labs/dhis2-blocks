import type { Attribution } from '@/components/program-rules'
import { programSchema, stageFormOf } from '../lib/metadata'
import { CHILD_VISIT, childVisitProgram } from './childVisit'
import type { ChildVisitVariant } from './childVisit'

/** The Child visit stage as the form reads it. */
export const childVisitForm = (variant?: ChildVisitVariant) => {
    const form = stageFormOf(
        programSchema.parse(childVisitProgram(variant)),
        CHILD_VISIT.stageId
    )
    if (form === undefined) {
        throw new Error('The Child visit stage is missing')
    }
    return form
}

/** An attribution to a rule named `ruleName`, reading `readsFields`. */
export const by = (
    ruleName: string,
    readsFields: string[] = [],
    condition = 'true'
) =>
    ({
        ruleId: `rule ${ruleName}`,
        ruleName,
        actionId: `action ${ruleName}`,
        condition,
        readsFields,
    }) satisfies Attribution

/** The Child visit option groups. */
export const CHILD_VISIT_GROUPS: ReadonlyMap<
    string,
    ReadonlySet<string>
> = new Map([
    ['labGrpRefer', new Set(['CLINIC', 'HOSPITAL'])],
    ['labGrpHome1', new Set(['HOME'])],
])
