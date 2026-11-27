/** The Child visit program in DHIS2 API JSON: a small stage whose rules use every effect on purpose. */
export const CHILD_VISIT = {
    programId: 'labChildVis',
    stageId: 'labChildStg',
    orgUnitId: 'labOrgUnit1',
    eventId: 'labVisit001',
    enrollmentId: 'labEnrol001',
} as const

interface OptionSet {
    id: string
    options: ReadonlyArray<readonly [code: string, name: string]>
}

const SEX: OptionSet = {
    id: 'labOsSex001',
    options: [
        ['M', 'Male'],
        ['F', 'Female'],
    ],
}
const DANGER: OptionSet = {
    id: 'labOsDanger',
    options: [
        ['CONVULSIONS', 'Convulsions'],
        ['LETHARGY', 'Lethargy'],
        ['VOMITING', 'Vomiting'],
    ],
}
const MALARIA: OptionSet = {
    id: 'labOsMalari',
    options: [
        ['POS', 'Positive'],
        ['NEG', 'Negative'],
        ['NOT_DONE', 'Not done'],
    ],
}
const OUTCOME: OptionSet = {
    id: 'labOsOutcom',
    options: [
        ['HOME', 'Sent home'],
        ['CLINIC', 'Referred to clinic'],
        ['HOSPITAL', 'Referred to hospital'],
    ],
}

interface DataElement {
    id: string
    label: string
    valueType: string
    variable?: string
    compulsory?: boolean
    allowFutureDate?: boolean
    optionSet?: OptionSet
}

const DATA_ELEMENTS: readonly DataElement[] = [
    {
        id: 'labWeight01',
        label: 'Weight (kg)',
        valueType: 'NUMBER',
        variable: 'weight',
        compulsory: true,
    },
    {
        id: 'labTempC001',
        label: 'Temperature (°C)',
        valueType: 'NUMBER',
        variable: 'temp',
    },
    {
        id: 'labDoseMg01',
        label: 'Paracetamol dose (mg)',
        valueType: 'NUMBER',
        variable: 'dose',
    },
    {
        id: 'labDailyMg1',
        label: 'Daily total (mg)',
        valueType: 'NUMBER',
        variable: 'daily',
    },
    {
        id: 'labSexCode1',
        label: 'Sex',
        valueType: 'TEXT',
        variable: 'sex',
        optionSet: SEX,
    },
    {
        id: 'labPregnant',
        label: 'Pregnant',
        valueType: 'BOOLEAN',
        variable: 'pregnant',
    },
    {
        id: 'labDanger01',
        label: 'Danger signs',
        valueType: 'MULTI_TEXT',
        variable: 'danger',
        optionSet: DANGER,
    },
    {
        id: 'labMalaria1',
        label: 'Malaria test',
        valueType: 'TEXT',
        variable: 'malaria',
        optionSet: MALARIA,
    },
    {
        id: 'labOutcome1',
        label: 'Outcome',
        valueType: 'TEXT',
        variable: 'outcome',
        optionSet: OUTCOME,
    },
    {
        id: 'labFollowUp',
        label: 'Follow-up date',
        valueType: 'DATE',
        allowFutureDate: true,
    },
    { id: 'labFollowNt', label: 'Follow-up notes', valueType: 'LONG_TEXT' },
    { id: 'labNoSect01', label: 'Internal code', valueType: 'TEXT' },
]

const SECTIONS = [
    {
        id: 'labSecMeas1',
        displayName: 'Measurements',
        dataElements: [
            'labWeight01',
            'labTempC001',
            'labDoseMg01',
            'labDailyMg1',
        ],
    },
    {
        id: 'labSecPatnt',
        displayName: 'Patient',
        dataElements: ['labSexCode1', 'labPregnant'],
    },
    {
        id: 'labSecAsses',
        displayName: 'Assessment',
        dataElements: ['labDanger01', 'labMalaria1', 'labOutcome1'],
    },
    {
        id: 'labSecFollw',
        displayName: 'Follow-up',
        dataElements: ['labFollowUp', 'labFollowNt'],
    },
]

const option = (
    id: string,
    displayName: string,
    {
        write = true,
        orgUnits = [],
        startDate,
        endDate,
    }: {
        write?: boolean
        orgUnits?: readonly string[]
        startDate?: string
        endDate?: string
    } = {}
) => ({
    id,
    displayName,
    access: { data: { write } },
    organisationUnits: orgUnits.map((unit) => ({ id: unit })),
    startDate,
    endDate,
})

/** Where the Child visit org unit sits: what `organisationUnits/labOrgUnit1?fields=path` answers. */
export const CHILD_VISIT_PATH = '/labCountry1/labDistrct1/labOrgUnit1'

/**
 * A combination of two categories, Funding and Outreach type. NGO partner is limited to the org unit's district, Donor
 * project to another org unit, Pilot grant ended, Mobile clinic starts in 2026, and Campaign the user cannot write to.
 */
export const CHILD_VISIT_COMBO = {
    id: 'labCatCombo',
    isDefault: false,
    categories: [
        {
            id: 'labCatFund1',
            displayName: 'Funding',
            categoryOptions: [
                option('labCoGovt01', 'Government'),
                option('labCoNgo001', 'NGO partner', {
                    orgUnits: ['labDistrct1'],
                }),
                option('labCoDonor1', 'Donor project', {
                    orgUnits: ['labOrgUnit2'],
                }),
                option('labCoPilot1', 'Pilot grant', {
                    endDate: '2025-06-30T00:00:00.000',
                }),
            ],
        },
        {
            id: 'labCatOutr1',
            displayName: 'Outreach type',
            categoryOptions: [
                option('labCoFixed1', 'Fixed site'),
                option('labCoMobile', 'Mobile clinic', {
                    startDate: '2026-01-01T00:00:00.000',
                }),
                option('labCoCampgn', 'Campaign', { write: false }),
            ],
        },
    ],
}

export interface ChildVisitVariant {
    sections?: boolean
    /** The program has `CHILD_VISIT_COMBO` rather than the default combination. */
    categories?: boolean
    blockEntryForm?: boolean
    write?: boolean
    validationStrategy?: 'ON_COMPLETE' | 'ON_UPDATE_AND_INSERT'
    /** The stage's feature type: `POINT`, `POLYGON` or `MULTI_POLYGON`; none by default. */
    featureType?: string
    /** The follow-up date may be after today, as by default. */
    futureFollowUp?: boolean
}

/** What `programs/<id>` answers, for the form's fields and the rules' names alike. */
export const childVisitProgram = ({
    sections = true,
    blockEntryForm = false,
    write = true,
    validationStrategy = 'ON_UPDATE_AND_INSERT',
    categories = false,
    featureType,
    futureFollowUp = true,
}: ChildVisitVariant = {}) => ({
    id: CHILD_VISIT.programId,
    name: 'Child visit',
    displayName: 'Child visit',
    programType: 'WITH_REGISTRATION',
    categoryCombo: categories
        ? CHILD_VISIT_COMBO
        : { id: 'bjDvmb4bfuf', isDefault: true, categories: [] },
    programStages: [
        {
            id: CHILD_VISIT.stageId,
            name: 'Child visit',
            displayName: 'Child visit',
            displayExecutionDateLabel: 'Visit date',
            featureType,
            validationStrategy,
            blockEntryForm,
            access: { data: { write } },
            programStageDataElements: DATA_ELEMENTS.map(
                ({
                    id,
                    label,
                    valueType,
                    compulsory = false,
                    allowFutureDate = false,
                    optionSet,
                }) => ({
                    compulsory,
                    allowFutureDate: allowFutureDate && futureFollowUp,
                    dataElement: {
                        id,
                        displayFormName: label,
                        valueType,
                        optionSet: optionSet && {
                            id: optionSet.id,
                            options: optionSet.options.map(
                                ([code, displayName]) => ({
                                    code,
                                    displayName,
                                })
                            ),
                        },
                    },
                })
            ),
            programStageSections: sections
                ? SECTIONS.map(({ id, displayName, dataElements }) => ({
                      id,
                      displayName,
                      dataElements: dataElements.map((element) => ({
                          id: element,
                      })),
                  }))
                : [],
        },
    ],
})

interface Action {
    type: string
    dataElement?: string
    section?: string
    content?: string
    data?: string
    location?: string
    option?: readonly [id: string, code: string]
    optionGroup?: { id: string; codes: readonly string[] }
}

const rule = (
    number: number,
    name: string,
    condition: string,
    actions: readonly Action[],
    priority?: number
) => {
    const id = `labRule${String(number).padStart(4, '0')}`
    return {
        id,
        name,
        displayName: name,
        condition,
        priority,
        programRuleActions: actions.map((action, at) => ({
            id: `labActn${String(number).padStart(3, '0')}${at}`,
            programRuleActionType: action.type,
            content: action.content,
            displayContent: action.content,
            data: action.data,
            location: action.location,
            dataElement: action.dataElement && { id: action.dataElement },
            programStageSection: action.section && { id: action.section },
            option: action.option && {
                id: action.option[0],
                code: action.option[1],
            },
            optionGroup: action.optionGroup && {
                id: action.optionGroup.id,
                options: action.optionGroup.codes.map((code) => ({ code })),
            },
        })),
    }
}

/** What `programRules` answers: every effect type, by rule name. */
export const CHILD_VISIT_RULES = {
    programRules: [
        rule(
            1,
            'Paracetamol dose',
            'd2:hasValue(#{weight})',
            [
                {
                    type: 'ASSIGN',
                    dataElement: 'labDoseMg01',
                    data: '#{weight} * 2',
                },
            ],
            1
        ),
        rule(
            2,
            'Daily total',
            'd2:hasValue(#{dose})',
            [
                {
                    type: 'ASSIGN',
                    dataElement: 'labDailyMg1',
                    data: '#{dose} * 4',
                },
            ],
            2
        ),
        rule(3, 'Hide pregnancy for men', "#{sex} == 'M'", [
            { type: 'HIDEFIELD', dataElement: 'labPregnant' },
        ]),
        rule(4, 'Pregnancy is no for men', "#{sex} == 'M'", [
            { type: 'ASSIGN', dataElement: 'labPregnant', data: "'false'" },
        ]),
        rule(
            5,
            'Follow-up after referral',
            "!d2:hasValue(#{outcome}) || #{outcome} == 'HOME'",
            [{ type: 'HIDESECTION', section: 'labSecFollw' }]
        ),
        rule(6, 'Fever needs a malaria test', '#{temp} > 38.5', [
            { type: 'SETMANDATORYFIELD', dataElement: 'labMalaria1' },
            {
                type: 'SHOWWARNING',
                dataElement: 'labTempC001',
                content: 'Fever: test for malaria',
            },
            {
                type: 'HIDEOPTION',
                dataElement: 'labMalaria1',
                option: ['labOptNotDn', 'NOT_DONE'],
            },
        ]),
        rule(7, 'Temperature out of range', '#{temp} > 43', [
            {
                type: 'SHOWERROR',
                dataElement: 'labTempC001',
                content: 'A temperature above 43 °C is not possible',
            },
        ]),
        rule(8, 'Weight check', '#{weight} > 100', [
            {
                type: 'WARNINGONCOMPLETE',
                dataElement: 'labWeight01',
                content: 'Check the weight: over 100 kg for a child',
            },
        ]),
        rule(
            9,
            'Pregnancy before completing',
            "#{sex} == 'F' && !d2:hasValue(#{pregnant})",
            [
                {
                    type: 'ERRORONCOMPLETE',
                    dataElement: 'labPregnant',
                    content: 'Answer Pregnant before completing',
                },
            ]
        ),
        rule(10, 'Referral with danger signs', 'd2:hasValue(#{danger})', [
            {
                type: 'SHOWOPTIONGROUP',
                dataElement: 'labOutcome1',
                optionGroup: {
                    id: 'labGrpRefer',
                    codes: ['CLINIC', 'HOSPITAL'],
                },
            },
        ]),
        rule(
            11,
            'Low weight goes to hospital',
            'd2:hasValue(#{weight}) && #{weight} < 2.5',
            [
                {
                    type: 'HIDEOPTIONGROUP',
                    dataElement: 'labOutcome1',
                    optionGroup: { id: 'labGrpHome1', codes: ['HOME'] },
                },
            ]
        ),
        rule(12, 'Dosing note', 'd2:hasValue(#{dose})', [
            {
                type: 'DISPLAYTEXT',
                location: 'feedback',
                content: 'Give paracetamol every 6 hours',
            },
        ]),
        rule(13, 'Dose summary', 'd2:hasValue(#{daily})', [
            {
                type: 'DISPLAYKEYVALUEPAIR',
                location: 'feedback',
                content: 'Daily total (mg)',
                data: '#{daily}',
            },
        ]),
        rule(
            14,
            'Visit date in the future',
            'd2:daysBetween(V{current_date}, V{event_date}) > 0',
            [{ type: 'SHOWERROR', content: 'The visit date is in the future' }]
        ),
        rule(
            15,
            'No malaria test when cold',
            'd2:hasValue(#{temp}) && #{temp} < 36',
            [{ type: 'HIDEFIELD', dataElement: 'labMalaria1' }]
        ),
    ],
}

/** What `programRuleVariables` answers: one variable per data element the rules read. */
export const CHILD_VISIT_VARIABLES = {
    programRuleVariables: DATA_ELEMENTS.flatMap(
        ({ id, valueType, variable, optionSet }) =>
            variable === undefined
                ? []
                : [
                      {
                          id: `labVar${variable.padEnd(5, '0').slice(0, 5)}`,
                          name: variable,
                          programRuleVariableSourceType:
                              'DATAELEMENT_CURRENT_EVENT',
                          useCodeForOptionSet: optionSet !== undefined,
                          dataElement: {
                              id,
                              valueType,
                              optionSet: optionSet && {
                                  id: optionSet.id,
                                  options: optionSet.options.map(
                                      ([code, name]) => ({
                                          code,
                                          name,
                                      })
                                  ),
                              },
                          },
                      },
                  ]
    ),
}

/** What `tracker/events/labVisit001` answers. */
export const SAVED_VISIT = {
    event: CHILD_VISIT.eventId,
    program: CHILD_VISIT.programId,
    programStage: CHILD_VISIT.stageId,
    orgUnit: CHILD_VISIT.orgUnitId,
    enrollment: CHILD_VISIT.enrollmentId,
    occurredAt: '2026-11-02T09:30:00.000',
    scheduledAt: '2026-11-01T00:00:00.000',
    status: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [-11.42, 8.47] },
    dataValues: [
        { dataElement: 'labWeight01', value: '12' },
        { dataElement: 'labTempC001', value: '37.2' },
        { dataElement: 'labSexCode1', value: 'F' },
        { dataElement: 'labPregnant', value: 'false' },
        { dataElement: 'labOutcome1', value: 'HOME' },
    ],
    notes: [
        {
            note: 'labNote0001',
            value: 'Mother reports fever since Sunday.',
            storedAt: '2026-11-02T09:41:12.000',
            storedBy: 'nurse',
            createdBy: { displayName: 'Aminata Sesay' },
        },
        {
            note: 'labNote0002',
            value: 'Weighed again after feeding.',
            storedAt: '2026-11-02T10:05:40.000',
            storedBy: 'clerk',
        },
    ],
}

/**
 * `SAVED_VISIT` as saved before the rules applied to it: the dose a rule now sets to 24 holds 20, its daily total is
 * empty, Pregnant holds Yes for a boy, which a rule now sets to No, and the malaria test holds Negative at a
 * temperature a rule now hides it at.
 */
export const RULES_CHANGED_VISIT = {
    ...SAVED_VISIT,
    dataValues: [
        { dataElement: 'labWeight01', value: '12' },
        { dataElement: 'labTempC001', value: '35.5' },
        { dataElement: 'labDoseMg01', value: '20' },
        { dataElement: 'labMalaria1', value: 'NEG' },
        { dataElement: 'labSexCode1', value: 'M' },
        { dataElement: 'labPregnant', value: 'true' },
        { dataElement: 'labOutcome1', value: 'HOME' },
    ],
}

/** `SAVED_VISIT` of the program with `CHILD_VISIT_COMBO`: Government, at a fixed site. */
export const SAVED_FUNDED_VISIT = {
    ...SAVED_VISIT,
    attributeOptionCombo: 'labAocGovFx',
    attributeCategoryOptions: 'labCoGovt01,labCoFixed1',
}
