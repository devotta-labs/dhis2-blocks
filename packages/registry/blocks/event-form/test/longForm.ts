/** A stage of 60 fields in 4 sections, numbers and texts in turn, whose one rule sets f003 from f001. */
export const LONG_FORM = {
    programId: 'testLongPrg',
    stageId: 'testLongStg',
    orgUnitId: 'testOrgUnit',
} as const

const FIELDS = Array.from({ length: 60 }, (_, at) => {
    const id = `f${String(at + 1).padStart(3, '0')}`
    return at % 2 === 0
        ? { id, label: `Reading ${id}`, valueType: 'NUMBER' }
        : { id, label: `Note ${id}`, valueType: 'TEXT' }
})

/** What `programs/<id>` answers. */
export const longFormProgram = () => ({
    id: LONG_FORM.programId,
    name: 'Long form',
    displayName: 'Long form',
    programStages: [
        {
            id: LONG_FORM.stageId,
            name: 'Long form',
            displayName: 'Long form',
            access: { data: { write: true } },
            programStageDataElements: FIELDS.map(
                ({ id, label, valueType }) => ({
                    dataElement: { id, displayFormName: label, valueType },
                })
            ),
            programStageSections: Array.from({ length: 4 }, (_, at) => ({
                id: `testLongSc${at}`,
                displayName: `Part ${at + 1}`,
                dataElements: FIELDS.slice(at * 15, at * 15 + 15).map(
                    ({ id }) => ({ id })
                ),
            })),
        },
    ],
})

export const LONG_FORM_RULES = {
    programRules: [
        {
            id: 'testLongRl1',
            name: 'Double the first reading',
            displayName: 'Double the first reading',
            condition: 'd2:hasValue(#{f001})',
            programRuleActions: [
                {
                    id: 'testLongAc1',
                    programRuleActionType: 'ASSIGN',
                    dataElement: { id: 'f003' },
                    data: '#{f001} * 2',
                },
            ],
        },
    ],
}

export const LONG_FORM_VARIABLES = {
    programRuleVariables: ['f001', 'f003'].map((id) => ({
        id: `testLongV${id}`,
        name: id,
        programRuleVariableSourceType: 'DATAELEMENT_CURRENT_EVENT',
        dataElement: { id, valueType: 'NUMBER' },
    })),
}
