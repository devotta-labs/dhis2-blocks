/** What a rule expression reads, each list deduplicated in order of appearance. */
export interface ExpressionReferences {
    /** Program rule variable names: `#{x}`, `A{x}` and `d2:hasValue('x')`-style names. */
    variables: string[]
    /** `V{x}` program variables such as `event_date`. */
    programVariables: string[]
    /** `C{uid}` constants. */
    constants: string[]
    /** Group ids or codes passed to `d2:inOrgUnitGroup`. */
    orgUnitGroups: string[]
}

// The engine's own collectors (ExpressionJs) are not exported from the
// package entry, so this small scanner stands in for them. A test checks it
// against the engine's parser on real and generated metadata.
const VARIABLE =
    /[#A]\{([^{}]+)\}|d2:(?:hasValue|count|countIfValue|countIfZeroPos|countIfCondition|maxValue|minValue|lastEventDate)\(\s*(['"])(.+?)\2/g
const PROGRAM_VARIABLE = /V\{([^{}]+)\}/g
const CONSTANT = /C\{([^{}]+)\}/g
const ORG_UNIT_GROUP = /d2:inOrgUnitGroup\(\s*(['"])(.+?)\1/g

const collect = (
    expression: string,
    pattern: RegExp,
    pick: (match: RegExpExecArray) => string | undefined
): string[] => {
    const found = new Set<string>()
    for (const match of expression.matchAll(pattern)) {
        const name = pick(match)?.trim()
        if (name) {
            found.add(name)
        }
    }
    return [...found]
}

export const scanExpression = (expression: string): ExpressionReferences => ({
    variables: collect(expression, VARIABLE, (match) => match[1] ?? match[3]),
    programVariables: collect(
        expression,
        PROGRAM_VARIABLE,
        (match) => match[1]
    ),
    constants: collect(expression, CONSTANT, (match) => match[1]),
    orgUnitGroups: collect(expression, ORG_UNIT_GROUP, (match) => match[2]),
})
