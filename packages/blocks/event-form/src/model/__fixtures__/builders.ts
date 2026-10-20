import type {
    Attribution,
    RuleEffects,
} from '@/registry/program-rules/use-program-rules'
import {
    DEFAULT_SECTION_ID,
    type DataElementMeta,
    type Section,
    type StageMetadata,
} from '../../api/schemas'
import type { BuildFormModelInput } from '../buildFormModel'

export const attribution = (ruleId = 'rule1'): Attribution => ({
    ruleId,
    ruleName: `Rule ${ruleId}`,
    actionId: `action-${ruleId}`,
    condition: 'true',
    readsFields: [],
})

export const emptyEffects = (): RuleEffects => ({
    hiddenFields: new Map(),
    hiddenSections: new Map(),
    mandatoryFields: new Map(),
    assignedValues: new Map(),
    messages: new Map(),
    hiddenOptions: new Map(),
    optionGroups: new Map(),
    optionAttributions: new Map(),
    displayTexts: [],
    keyValuePairs: [],
    hiddenProgramStages: new Set(),
    programStageAttributions: new Map(),
})

export const dataElement = (
    id: string,
    extra: Partial<DataElementMeta> = {}
): DataElementMeta => ({
    id,
    label: `Label ${id}`,
    valueType: 'TEXT',
    compulsory: false,
    allowFutureDate: false,
    ...extra,
})

export const stageMetadata = (
    elements: DataElementMeta[],
    extra: {
        sections?: Section[]
        validationStrategy?: StageMetadata['stage']['validationStrategy']
        featureType?: StageMetadata['stage']['featureType']
        hasCategoryCombo?: boolean
    } = {}
): StageMetadata => ({
    programId: 'prog1',
    programName: 'Program',
    stage: {
        id: 'stage1',
        name: 'Stage',
        validationStrategy: extra.validationStrategy ?? 'ON_COMPLETE',
        blockEntryForm: false,
        featureType: extra.featureType ?? 'NONE',
        sections: extra.sections ?? [
            {
                id: DEFAULT_SECTION_ID,
                name: 'Stage',
                dataElementIds: elements.map(({ id }) => id),
            },
        ],
    },
    dataElements: new Map(elements.map((element) => [element.id, element])),
    hasCategoryCombo: extra.hasCategoryCombo ?? false,
})

/** A form model input with nothing in it but the metadata, and the given overrides. */
export const baseInput = (
    metadata: StageMetadata,
    extra: Partial<BuildFormModelInput> = {}
): BuildFormModelInput => ({
    metadata,
    effective: {},
    stored: {},
    effects: emptyEffects(),
    optionGroupOptions: new Map(),
    fieldErrors: {},
    showAllErrors: false,
    isCompleting: false,
    ...extra,
})

export const options = (...codes: string[]) =>
    codes.map((code) => ({ id: `id-${code}`, code, label: `Label ${code}` }))

export const threeFields = () =>
    stageMetadata([dataElement('a'), dataElement('b'), dataElement('c')])
