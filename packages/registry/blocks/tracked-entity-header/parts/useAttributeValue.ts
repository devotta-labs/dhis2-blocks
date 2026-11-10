import { formatDhis2Value } from '@/components/dhis2-value-display'
import i18n from '@dhis2/d2-i18n'
import { useEffect, useLayoutEffect } from 'react'
import { useHeaderContext, type HeaderContextValue } from '../provider/context'
import { isProduction } from '../provider/env'

export type AttributeValueState =
    /** Nothing to show yet: the record is loading, failed or restricted. */
    | { kind: 'hidden' }
    | { kind: 'value'; label: string; text: string }
    | { kind: 'missing'; label: string }
    | { kind: 'unavailable'; label?: string }
    | { kind: 'misconfigured'; message: string }

const describeMisconfigured = (
    uid: string,
    { program, state }: HeaderContextValue
) => {
    const known =
        state.status === 'ready'
            ? [...state.metadata.attributes.values()]
                  .map(({ id, label }) => `${id} (${label})`)
                  .join(', ')
            : ''
    const scope = program ? `program ${program}` : 'the tracked entity type'
    return `Attribute ${uid} is not an attribute of ${scope}. Attributes: ${known || 'none'}`
}

/** One attribute's state, by the rules every value part shares. Pure: parts add placement and logging. */
export const resolveAttribute = (
    uid: string,
    context: HeaderContextValue
): AttributeValueState => {
    const { state, display } = context
    if (state.status !== 'ready') {
        return { kind: 'hidden' }
    }
    const { metadata, trackedEntity } = state
    const meta = metadata.attributes.get(uid)
    const invalid = metadata.invalid.get(uid)
    if (!meta) {
        return invalid
            ? { kind: 'unavailable', label: invalid.label }
            : {
                  kind: 'misconfigured',
                  message: describeMisconfigured(uid, context),
              }
    }
    const raw = trackedEntity.values.get(uid)
    if (raw === undefined || raw === '') {
        return { kind: 'missing', label: meta.label }
    }
    return {
        kind: 'value',
        label: meta.label,
        text: formatDhis2Value(
            raw,
            { valueType: meta.valueType, optionSet: meta.optionSet },
            display
        ),
    }
}

/** In production the full message goes to the console, once; development shows it on the part. */
export const useLoggedProblem = (message: string | undefined) => {
    const { logProblem } = useHeaderContext()
    useEffect(() => {
        if (message !== undefined && isProduction()) {
            logProblem(message)
        }
    }, [message, logProblem])
}

/** What a part shows for a problem with its own setup. */
export const setupMessage = (message: string) =>
    isProduction() ? i18n.t("This part isn't set up correctly") : message

/**
 * One attribute of the provider's tracked entity, ready to show. Registers the uid as
 * placed while mounted, so the details list skips it.
 */
export const useAttributeValue = (uid: string): AttributeValueState => {
    const context = useHeaderContext()
    const { placeAttribute } = context
    useLayoutEffect(() => placeAttribute(uid), [placeAttribute, uid])
    const result = resolveAttribute(uid, context)
    useLoggedProblem(
        result.kind === 'misconfigured' ? result.message : undefined
    )
    return result
}
