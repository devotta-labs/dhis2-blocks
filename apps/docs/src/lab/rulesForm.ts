import type {
    CellKey,
    DataEntrySource,
    GridColumn,
    OutboxRecord,
    SaveOutcome,
} from '@/components/data-entry'

/**
 * A small clinic visit form with program rules written here, not stored on a server: one or more rules for every
 * action the grid acts on. `RULES_SERVER` answers every request the demo makes.
 */

const PROGRAM = 'labRulesPrg'
const STAGE = 'labVisitStg'
const FOLLOW_UP = 'labFollowSc'
const ORG_UNIT = 'DiszpKrYNg8'

const options = (...codes: string[]) =>
    codes.map((code) => ({
        code,
        name: code.charAt(0) + code.slice(1).toLowerCase(),
    }))

const SEX = options('FEMALE', 'MALE')
const DIAGNOSES = options(
    'MALARIA',
    'PNEUMONIA',
    'DIARRHOEA',
    'HYPERTENSION',
    'DIABETES'
)
const OUTCOMES = options('HEALED', 'REFERRED', 'DIED')

// Ids are DHIS2-shaped (11 characters), as the rule engine expects data element ids to be.
const FIELDS = [
    {
        id: 'labAgeYears',
        name: 'age',
        label: 'Age (years)',
        valueType: 'INTEGER_ZERO_OR_POSITIVE',
    },
    {
        id: 'labSexField',
        name: 'sex',
        label: 'Sex',
        valueType: 'TEXT',
        options: SEX,
    },
    {
        id: 'labPregnant',
        name: 'pregnant',
        label: 'Pregnant',
        valueType: 'BOOLEAN',
    },
    {
        id: 'labWeightKg',
        name: 'weight',
        label: 'Weight (kg)',
        valueType: 'NUMBER',
    },
    {
        id: 'labHeightCm',
        name: 'height',
        label: 'Height (cm)',
        valueType: 'NUMBER',
    },
    { id: 'labBmiValue', name: 'bmi', label: 'BMI', valueType: 'NUMBER' },
    {
        id: 'labDiagnose',
        name: 'diagnosis',
        label: 'Diagnosis',
        valueType: 'TEXT',
        options: DIAGNOSES,
    },
    {
        id: 'labReferred',
        name: 'referred',
        label: 'Referred',
        valueType: 'BOOLEAN',
    },
    {
        id: 'labReferRsn',
        name: 'reason',
        label: 'Referral reason',
        valueType: 'TEXT',
    },
    {
        id: 'labOutcomeX',
        name: 'outcome',
        label: 'Outcome',
        valueType: 'TEXT',
        options: OUTCOMES,
    },
    {
        id: 'labFollowUp',
        name: 'followUp',
        label: 'Follow-up date',
        valueType: 'DATE',
    },
    {
        id: 'labFollowNt',
        name: 'followNotes',
        label: 'Follow-up notes',
        valueType: 'TEXT',
    },
] as const

const ID_BY_NAME = new Map<string, string>(
    FIELDS.map(({ name, id }) => [name, id])
)

const field = (name: (typeof FIELDS)[number]['name']) => ({
    id: ID_BY_NAME.get(name) ?? name,
})

interface LabRule {
    name: string
    /** What it shows, for the lab's list of rules. */
    shows: string
    condition: string
    actions: Array<{
        programRuleActionType: string
        dataElement?: { id: string }
        programStageSection?: { id: string }
        content?: string
        data?: string
        location?: string
        option?: { id: string; code: string }
        optionGroup?: { id: string; options: Array<{ code: string }> }
    }>
}

export const RULES: LabRule[] = [
    {
        name: 'Hide pregnancy for men',
        shows: 'HIDEFIELD: Pregnant, when Sex is Male',
        condition: "#{sex} == 'MALE'",
        actions: [
            {
                programRuleActionType: 'HIDEFIELD',
                dataElement: field('pregnant'),
            },
        ],
    },
    {
        name: 'Work out BMI',
        shows: 'ASSIGN: BMI from weight and height, rounded (read-only)',
        condition:
            "d2:hasValue('weight') && d2:hasValue('height') && #{height} > 0",
        actions: [
            {
                programRuleActionType: 'ASSIGN',
                dataElement: field('bmi'),
                data: 'd2:round(#{weight} * 10000 / (#{height} * #{height}))',
            },
        ],
    },
    {
        name: 'Unusual weight',
        shows: 'SHOWWARNING: on Weight, over 150 kg',
        condition: "d2:hasValue('weight') && #{weight} > 150",
        actions: [
            {
                programRuleActionType: 'SHOWWARNING',
                dataElement: field('weight'),
                content: 'This weight is unusually high: check it',
            },
        ],
    },
    {
        name: 'Impossible weight',
        shows: 'SHOWERROR: on Weight, zero or less',
        condition: "d2:hasValue('weight') && #{weight} <= 0",
        actions: [
            {
                programRuleActionType: 'SHOWERROR',
                dataElement: field('weight'),
                content: 'Weight must be more than 0',
            },
        ],
    },
    {
        name: 'Reason for referral',
        shows: 'SETMANDATORYFIELD: Referral reason, when Referred is Yes',
        condition: '#{referred} == true',
        actions: [
            {
                programRuleActionType: 'SETMANDATORYFIELD',
                dataElement: field('reason'),
            },
        ],
    },
    {
        name: 'Childhood diagnoses',
        shows: 'SHOWOPTIONGROUP: only childhood diagnoses, under 5',
        condition: "d2:hasValue('age') && #{age} < 5",
        actions: [
            {
                programRuleActionType: 'SHOWOPTIONGROUP',
                dataElement: field('diagnosis'),
                optionGroup: {
                    id: 'labChildGrp',
                    options: [
                        { code: 'MALARIA' },
                        { code: 'PNEUMONIA' },
                        { code: 'DIARRHOEA' },
                    ],
                },
            },
        ],
    },
    {
        name: 'No chronic diagnoses for teenagers',
        shows: 'HIDEOPTIONGROUP: chronic diagnoses, 5 to 17',
        condition: "d2:hasValue('age') && #{age} >= 5 && #{age} < 18",
        actions: [
            {
                programRuleActionType: 'HIDEOPTIONGROUP',
                dataElement: field('diagnosis'),
                optionGroup: {
                    id: 'labChronicG',
                    options: [{ code: 'HYPERTENSION' }, { code: 'DIABETES' }],
                },
            },
        ],
    },
    {
        name: 'Referred visits were not healed here',
        shows: 'HIDEOPTION: Healed, when Referred is Yes',
        condition: '#{referred} == true',
        actions: [
            {
                programRuleActionType: 'HIDEOPTION',
                dataElement: field('outcome'),
                option: { id: 'labOptHeald', code: 'HEALED' },
            },
        ],
    },
    {
        name: 'No follow-up once healed',
        shows: 'HIDESECTION: Follow-up date and notes, when healed',
        condition: "#{outcome} == 'HEALED'",
        actions: [
            {
                programRuleActionType: 'HIDESECTION',
                programStageSection: { id: FOLLOW_UP },
            },
        ],
    },
    {
        name: 'Age group',
        shows: 'DISPLAYKEYVALUEPAIR: the age group, by the row',
        condition: "d2:hasValue('age')",
        actions: [
            {
                programRuleActionType: 'DISPLAYKEYVALUEPAIR',
                content: 'Age group:',
                data: "d2:condition('#{age} < 5', 'under 5', d2:condition('#{age} < 18', '5 to 17', 'adult'))",
                location: 'indicators',
            },
        ],
    },
    {
        name: 'Check the BMI',
        shows: 'DISPLAYTEXT: a note by the row, BMI under 16',
        condition: "d2:hasValue('bmi') && #{bmi} < 16",
        actions: [
            {
                programRuleActionType: 'DISPLAYTEXT',
                content: 'Low BMI: consider a nutrition referral',
                location: 'feedback',
            },
        ],
    },
    {
        name: 'Outcome before completing',
        shows: 'ERRORONCOMPLETE: completing needs an Outcome',
        condition: "!d2:hasValue('outcome')",
        actions: [
            {
                programRuleActionType: 'ERRORONCOMPLETE',
                content: 'Choose an outcome before completing the visit',
            },
        ],
    },
    {
        name: 'Weigh before completing',
        shows: 'WARNINGONCOMPLETE: completing without a Weight',
        condition: "!d2:hasValue('weight')",
        actions: [
            {
                programRuleActionType: 'WARNINGONCOMPLETE',
                content: 'The visit has no weight',
            },
        ],
    },
]

/** A rule variable's data element, as `programRuleVariables` returns it. */
type RuleSource = {
    id: string
    valueType: string
    optionSet?: { id: string; options: Array<{ code: string; name: string }> }
}

/**
 * Everything the grid and the `program-rules` block ask DHIS2 for in the rules demo, answered here: the rules above, a
 * ISO calendar (`RulesData` adds the signed-in user). Any other request fails, so nothing reaches the server unnoticed.
 */
export const RULES_SERVER = {
    programRules: {
        programRules: RULES.map(({ name, condition, actions }, at) => ({
            id: `labRule${String(at).padStart(4, '0')}`,
            name,
            displayName: name,
            condition,
            programRuleActions: actions.map((action, actionAt) => ({
                id: `labAct${String(at).padStart(3, '0')}${actionAt}`,
                ...action,
            })),
        })),
    },
    programRuleVariables: {
        programRuleVariables: FIELDS.map((each) => {
            const dataElement: RuleSource = {
                id: each.id,
                valueType: each.valueType,
            }
            if ('options' in each) {
                dataElement.optionSet = {
                    id: `labSet${each.id.slice(3, 8)}`,
                    options: [...each.options],
                }
            }
            return {
                id: `labVar${each.id.slice(3, 8)}`,
                name: each.name,
                programRuleVariableSourceType: 'DATAELEMENT_CURRENT_EVENT',
                useCodeForOptionSet: true,
                dataElement,
            }
        }),
    },
    constants: { constants: [] },
    programs: {
        id: PROGRAM,
        name: 'Lab clinic visits',
        programStages: [{ id: STAGE, name: 'Visit' }],
    },
    'system/info': { calendar: 'iso8601', dateFormat: 'yyyy-mm-dd' },
}

const SAMPLES: Array<Partial<Record<(typeof FIELDS)[number]['name'], string>>> =
    [
        {
            age: '3',
            sex: 'MALE',
            weight: '13',
            height: '95',
            diagnosis: 'MALARIA',
        },
        {
            age: '28',
            sex: 'FEMALE',
            pregnant: 'true',
            weight: '165',
            height: '160',
        },
        {
            age: '45',
            sex: 'MALE',
            weight: '0',
            referred: 'true',
            outcome: 'REFERRED',
        },
        {
            age: '14',
            sex: 'FEMALE',
            weight: '30',
            height: '150',
            outcome: 'HEALED',
        },
        {},
    ]

/** The clinic visits in memory: each change saved at once, and the rules' program for the grid to load. */
export const rulesSource = (
    onSave: (records: ReadonlyArray<OutboxRecord>) => void
): DataEntrySource => {
    const columns: GridColumn[] = FIELDS.map(
        ({ id, label, valueType, ...rest }) => ({
            id,
            label,
            field: {
                valueType,
                options: 'options' in rest ? [...rest.options] : undefined,
            },
        })
    )
    const rows = SAMPLES.map((_, at) => ({
        id: `visit${at + 1}`,
        label: `Visit ${at + 1}`,
        programStageId: STAGE,
        orgUnitId: ORG_UNIT,
        status: 'ACTIVE' as const,
    }))
    const stored = new Map<CellKey, string>(
        SAMPLES.flatMap((values, at) =>
            Object.entries(values).map(([name, value]): [CellKey, string] => [
                `visit${at + 1}.${ID_BY_NAME.get(name) ?? name}`,
                value,
            ])
        )
    )
    const key = 'lab:rules'
    const saved = (
        records: ReadonlyArray<{ sourceKey: string; key: CellKey }>
    ) =>
        records.map(({ sourceKey, key: cell }): SaveOutcome => ({
            sourceKey,
            key: cell,
            result: 'saved',
        }))
    return {
        key,
        load: async () => ({
            tables: [
                {
                    id: 'visits',
                    title: 'Clinic visits, with program rules',
                    rows,
                    columns,
                    headerRows: [
                        columns.map(({ id, label }) => ({
                            id,
                            label,
                            span: 1,
                        })),
                    ],
                    closed: new Map(),
                },
            ],
            values: new Map(stored),
            required: new Map(),
            strategy: new Map([[STAGE, 'ON_UPDATE_AND_INSERT']]),
            sections: new Map([
                [
                    STAGE,
                    new Map([
                        [
                            FOLLOW_UP,
                            [field('followUp').id, field('followNotes').id],
                        ],
                    ]),
                ],
            ]),
            readOnlyRows: new Map(),
            canReopen: new Set(rows.map(({ id }) => id)),
            readOnlyWhenCompleted: new Map(),
            mayUncomplete: true,
            rules: {
                programId: PROGRAM,
                programStageIds: [STAGE],
                tracker: false,
                enrollmentIds: [],
                hasRules: true,
            },
            newRows: {
                tableId: 'visits',
                programStageId: STAGE,
                orgUnitId: ORG_UNIT,
            },
            closedByStage: new Map(),
            orgUnitNames: new Map(),
            fileNames: new Map(),
            hasMore: false,
        }),
        save: async (_engine, records) => {
            onSave(records)
            for (const { key: cell, value } of records) {
                if (value === null) {
                    stored.delete(cell)
                } else {
                    stored.set(cell, value)
                }
            }
            return saved(records)
        },
        setStatus: async (_engine, rowId) =>
            saved([{ sourceKey: key, key: `${rowId}.status` }]),
        restoreRows: async () => [],
    }
}
