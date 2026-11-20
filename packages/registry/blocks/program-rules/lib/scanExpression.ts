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

/** One reference in an expression, where it was found. */
export interface ExpressionReference {
    kind: 'variable' | 'programVariable' | 'constant' | 'orgUnitGroup'
    name: string
    /** Offset of the first character of the match. */
    start: number
    /** Offset just past the match. A function's closing parenthesis is not part of it. */
    end: number
    /**
     * Set when the name is the first argument of a `d2:` function, e.g. `hasValue` for both
     * `d2:hasValue('x')` and `d2:hasValue(#{x})`. The match then starts at `d2:`.
     */
    fn?: string
}

const VARIABLE_FUNCTIONS =
    'hasValue|count|countIfValue|countIfZeroPos|countIfCondition|maxValue|minValue|lastEventDate'
const REFERENCE = new RegExp(
    [
        `d2:(${VARIABLE_FUNCTIONS})\\(\\s*(?:(['"])(.+?)\\2|[#A]\\{([^{}]+)\\})`,
        `d2:inOrgUnitGroup\\(\\s*(['"])(.+?)\\5`,
        `[#A]\\{([^{}]+)\\}`,
        `V\\{([^{}]+)\\}`,
        `C\\{([^{}]+)\\}`,
    ].join('|'),
    'g'
)

const reference: (
    match: RegExpExecArray
) => Omit<ExpressionReference, 'start' | 'end'> | undefined = (match) => {
    const [, fn, , quoted, braced, , group, variable, program, constant] = match
    const name = (
        quoted ??
        braced ??
        group ??
        variable ??
        program ??
        constant
    )?.trim()
    if (!name) {
        return undefined
    }
    if (fn !== undefined) {
        return { kind: 'variable', name, fn }
    }
    if (group !== undefined) {
        return { kind: 'orgUnitGroup', name, fn: 'inOrgUnitGroup' }
    }
    if (variable !== undefined) {
        return { kind: 'variable', name }
    }
    return program !== undefined
        ? { kind: 'programVariable', name }
        : { kind: 'constant', name }
}

/** Every reference in the expression, in order of appearance, with its position. */
export const expressionReferences: (
    expression: string
) => ExpressionReference[] = (expression) =>
    [...expression.matchAll(REFERENCE)].flatMap((match) => {
        const found = reference(match)
        return found === undefined
            ? []
            : [
                  {
                      ...found,
                      start: match.index,
                      end: match.index + match[0].length,
                  },
              ]
    })

const namesOf = (
    references: ReadonlyArray<ExpressionReference>,
    kind: ExpressionReference['kind']
) => [
    ...new Set(
        references
            .filter((found) => found.kind === kind)
            .map((found) => found.name)
    ),
]

export const scanExpression: (expression: string) => ExpressionReferences = (
    expression
) => {
    const references = expressionReferences(expression)
    return {
        variables: namesOf(references, 'variable'),
        programVariables: namesOf(references, 'programVariable'),
        constants: namesOf(references, 'constant'),
        orgUnitGroups: namesOf(references, 'orgUnitGroup'),
    }
}
