/** A piece of a rule condition, ready to show: plain text or a reference to an answer. */
export type ConditionPart =
    | { kind: 'text'; text: string }
    /** `fieldId` is unset for a variable that reads no field, such as `V{event_date}`. */
    | { kind: 'field'; name: string; fieldId?: string }

const TOKEN =
    /d2:hasValue\(\s*(?:'([^']+)'|[#A]\{([^}]+)\})\s*\)|[#A]\{([^}]+)\}|V\{([^}]+)\}|&&|\|\||!==|===|!=|==|!/g

const OPERATORS = new Map([
    ['&&', ' and '],
    ['||', ' or '],
    ['===', ' = '],
    ['==', ' = '],
    ['!==', ' ≠ '],
    ['!=', ' ≠ '],
    ['!', 'not '],
])

/**
 * Splits a rule condition into text and answer references, with the operators spelled out:
 * `!#{chronic} && d2:hasValue('lmp')` → "not ", [chronic], " and ", [lmp], " has a value".
 */
export const parseCondition = (
    condition: string,
    variables: ReadonlyMap<string, string>
): ConditionPart[] => {
    const parts: ConditionPart[] = []
    const text = (value: string) => {
        const last = parts.at(-1)
        if (last?.kind === 'text') {
            last.text += value
        } else if (value !== '') {
            parts.push({ kind: 'text', text: value })
        }
    }
    const field = (name: string) =>
        parts.push({ kind: 'field', name, fieldId: variables.get(name) })

    let cursor = 0
    for (const match of condition.matchAll(TOKEN)) {
        text(condition.slice(cursor, match.index))
        cursor = match.index + match[0].length
        const [token, quoted, braced, variable, programVariable] = match
        const hasValue = quoted ?? braced
        if (hasValue !== undefined) {
            field(hasValue)
            text(' has a value')
        } else if (variable !== undefined) {
            field(variable)
        } else if (programVariable !== undefined) {
            parts.push({ kind: 'field', name: programVariable })
        } else {
            text(OPERATORS.get(token) ?? token)
        }
    }
    text(condition.slice(cursor))
    for (const part of parts) {
        if (part.kind === 'text') {
            part.text = part.text.replace(/\s+/g, ' ')
        }
    }
    return parts
}
