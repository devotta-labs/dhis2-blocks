import { expressionReferences } from '@/registry/program-rules/index'

/** A piece of a rule condition, ready to show: plain text or a reference to an answer. */
export type ConditionPart =
    | { kind: 'text'; text: string }
    /** `fieldId` is unset for a variable that reads no field, such as `V{event_date}`. */
    | { kind: 'field'; name: string; fieldId?: string }

const OPERATOR = /&&|\|\||!==|===|!=|==|!/g

const OPERATORS = new Map([
    ['&&', ' and '],
    ['||', ' or '],
    ['===', ' = '],
    ['==', ' = '],
    ['!==', ' ≠ '],
    ['!=', ' ≠ '],
    ['!', 'not '],
])

/** The closing parenthesis of `d2:hasValue(`, which the reference stops short of. */
const CLOSING = /^\s*\)/

/**
 * Splits a rule condition into text and answer references, with the operators spelled out:
 * `!#{chronic} && d2:hasValue('lmp')` → "not ", [chronic], " and ", [lmp], " has a value".
 * References come from the rule lib's scanner, so the lens reads expressions as the dependency
 * graph does.
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
    const prose = (value: string) =>
        text(value.replace(OPERATOR, (token) => OPERATORS.get(token) ?? token))
    const field = (name: string) =>
        parts.push({ kind: 'field', name, fieldId: variables.get(name) })

    let cursor = 0
    for (const reference of expressionReferences(condition)) {
        prose(condition.slice(cursor, reference.start))
        cursor = reference.end
        if (reference.kind === 'programVariable') {
            parts.push({ kind: 'field', name: reference.name })
        } else if (reference.kind !== 'variable') {
            // Constants and org unit groups read no answer: shown as written.
            text(condition.slice(reference.start, reference.end))
        } else if (reference.fn === 'hasValue') {
            field(reference.name)
            text(' has a value')
            cursor += CLOSING.exec(condition.slice(cursor))?.[0].length ?? 0
        } else {
            if (reference.fn !== undefined) {
                text(`d2:${reference.fn}(`)
            }
            field(reference.name)
        }
    }
    prose(condition.slice(cursor))
    for (const part of parts) {
        if (part.kind === 'text') {
            part.text = part.text.replace(/\s+/g, ' ')
        }
    }
    return parts
}
