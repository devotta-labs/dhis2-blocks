import { useProgramRuleContext } from '@/registry/program-rules/use-program-rules'
import { useMemo } from 'react'
import type { createAppWorkingListClient } from '../../AppShell/createAppWorkingListClient'
import {
    useProgramLabels,
    type ProgramLabels,
} from '../../ProgramRulesGraph/useProgramRulesGraphData'

type Client = ReturnType<typeof createAppWorkingListClient>

interface LensRule {
    name: string
    condition: string
    actionTypes: string[]
}

export interface LensMetadata {
    /** Field, section and stage names, shared with the rules graph. */
    labels: ProgramLabels
    /** The stage's rules that the engine runs, so a rule that is not acting still has a name. */
    rules: Map<string, LensRule>
    /** Program rule variable name → the field it reads. */
    variables: Map<string, string>
}

/**
 * What the lens needs beyond the form's rule effects: the stage's rule metadata, from the same
 * queries the form's rules use, and the program's labels, from the same query as the rules graph.
 * The sections come from the form itself.
 */
export const useLensMetadata = (
    client: Client,
    programId: string,
    programStageId: string
) => {
    const rules = useProgramRuleContext({ programId, programStageId })
    const labels = useProgramLabels(client, programId)
    const { context, metadata } = rules
    const data = useMemo((): LensMetadata | undefined => {
        if (
            context === undefined ||
            metadata === undefined ||
            labels.data === undefined
        ) {
            return undefined
        }
        const variables = new Map<string, string>()
        for (const variable of metadata.variables) {
            const fieldId = variable.dataElementId ?? variable.attributeId
            if (fieldId !== undefined) {
                variables.set(variable.name, fieldId)
            }
        }
        return {
            labels: labels.data,
            rules: new Map(
                [...context.ruleInfo.values()].map((info) => [
                    info.id,
                    {
                        name: info.name,
                        condition: info.condition,
                        actionTypes: [...info.actions.keys()].flatMap(
                            (actionId) => {
                                const type =
                                    context.actionMetadata.get(actionId)?.type
                                return type === undefined ? [] : [type]
                            }
                        ),
                    },
                ])
            ),
            variables,
        }
    }, [context, metadata, labels.data])
    return { data, error: rules.error ?? labels.error ?? undefined }
}
