import { CHILD_VISIT, childVisitProgram, SAVED_VISIT } from '../test/childVisit'
import {
    EVENT_FIELDS,
    heldEventSchema,
    PROGRAM_FIELDS,
    programSchema,
    settingsOf,
    stageFormOf,
    systemInfoSchema,
    valuesOf,
} from './metadata'
import { childVisitForm as formOf } from '../test/forms'

describe('the requested fields', () => {
    it('ask for what the schemas read', () => {
        expect(PROGRAM_FIELDS).toContain('displayExecutionDateLabel')
        expect(PROGRAM_FIELDS).toContain('programStageSections[')
        expect(EVENT_FIELDS).toContain('assignedUser[uid,username]')
        expect(EVENT_FIELDS).toContain('dataValues[dataElement,value]')
        expect(EVENT_FIELDS).toContain('attributeCategoryOptions')
        expect(EVENT_FIELDS).toContain('geometry')
        expect(PROGRAM_FIELDS).toContain('featureType')
        expect(PROGRAM_FIELDS).toContain(
            'categoryCombo[id,isDefault,categories[id,displayName,categoryOptions[id,displayName,access[data[write]],organisationUnits[id],startDate,endDate]]]'
        )
    })
})

describe('categories', () => {
    it('reads none for the default combination, or none given', () => {
        expect(formOf().categories).toEqual([])
        const { categoryCombo: _combo, ...program } = childVisitProgram()
        expect(
            stageFormOf(programSchema.parse(program), CHILD_VISIT.stageId)
                ?.categories
        ).toEqual([])
    })

    it('reads each category in order, with its options as a choice by id', () => {
        const [funding, outreach] = formOf({ categories: true }).categories
        expect(funding).toMatchObject({ id: 'labCatFund1', name: 'Funding' })
        expect(funding.options[1]).toEqual({
            id: 'labCoNgo001',
            name: 'NGO partner',
            canWrite: true,
            orgUnitIds: ['labDistrct1'],
            startDate: undefined,
            endDate: undefined,
        })
        expect(outreach.field).toEqual({
            valueType: 'TEXT',
            options: [
                { code: 'labCoFixed1', name: 'Fixed site' },
                { code: 'labCoMobile', name: 'Mobile clinic' },
                { code: 'labCoCampgn', name: 'Campaign' },
            ],
        })
    })
})

describe('stageFormOf', () => {
    it('gives nothing for a stage the program does not have', () => {
        expect(
            stageFormOf(programSchema.parse(childVisitProgram()), 'nope')
        ).toBeUndefined()
    })

    it('reads the stage', () => {
        const form = formOf({ validationStrategy: 'ON_COMPLETE', write: false })
        expect(form).toMatchObject({
            id: CHILD_VISIT.stageId,
            name: 'Child visit',
            eventDateLabel: 'Visit date',
            validationStrategy: 'ON_COMPLETE',
            blockEntryForm: false,
            canWrite: false,
        })
    })

    it('reads the stage’s feature type as the location it has', () => {
        expect(formOf().location).toBe('none')
        expect(formOf({ featureType: 'NONE' }).location).toBe('none')
        expect(formOf({ featureType: 'POINT' }).location).toBe('point')
        expect(formOf({ featureType: 'POLYGON' }).location).toBe('area')
        expect(formOf({ featureType: 'MULTI_POLYGON' }).location).toBe('area')
    })

    it('says "Report date" when the stage has no event date label', () => {
        const program = childVisitProgram()
        const [stage] = program.programStages
        const parsed = programSchema.parse({
            programStages: [{ ...stage, displayExecutionDateLabel: null }],
        })
        expect(stageFormOf(parsed, CHILD_VISIT.stageId)?.eventDateLabel).toBe(
            'Report date'
        )
    })

    it('keeps sections and their fields in metadata order', () => {
        const form = formOf()
        expect(form.sections).toEqual([
            {
                id: 'labSecMeas1',
                name: 'Measurements',
                fieldIds: [
                    'labWeight01',
                    'labTempC001',
                    'labDoseMg01',
                    'labDailyMg1',
                ],
            },
            {
                id: 'labSecPatnt',
                name: 'Patient',
                fieldIds: ['labSexCode1', 'labPregnant'],
            },
            {
                id: 'labSecAsses',
                name: 'Assessment',
                fieldIds: ['labDanger01', 'labMalaria1', 'labOutcome1'],
            },
            {
                id: 'labSecFollw',
                name: 'Follow-up',
                fieldIds: ['labFollowUp', 'labFollowNt'],
            },
        ])
    })

    it('holds a field in no section, but in no section either', () => {
        const form = formOf()
        expect(form.fields.has('labNoSect01')).toBe(true)
        expect(
            form.sections.some(({ fieldIds }) =>
                fieldIds.includes('labNoSect01')
            )
        ).toBe(false)
    })

    it('makes one unnamed section of every field when the stage has none', () => {
        const form = formOf({ sections: false })
        expect(form.sections).toEqual([
            {
                id: CHILD_VISIT.stageId,
                fieldIds: [...form.fields.keys()],
            },
        ])
        expect(form.sections[0].fieldIds).toHaveLength(12)
    })

    it('reads each field with its options by name', () => {
        const form = formOf()
        expect(form.fields.get('labWeight01')).toEqual({
            id: 'labWeight01',
            label: 'Weight (kg)',
            compulsory: true,
            allowFutureDate: false,
            field: { valueType: 'NUMBER' },
        })
        expect(form.fields.get('labFollowUp')?.allowFutureDate).toBe(true)
        expect(form.fields.get('labSexCode1')?.field.options).toEqual([
            { code: 'M', name: 'Male' },
            { code: 'F', name: 'Female' },
        ])
    })
})

describe('settingsOf', () => {
    it('reads the calendar and the date format', () => {
        expect(
            settingsOf(
                systemInfoSchema.parse({
                    calendar: 'ethiopian',
                    dateFormat: 'dd-mm-yyyy',
                })
            )
        ).toEqual({ calendar: 'ethiopian', dateFormat: 'DD-MM-YYYY' })
    })

    it('falls back to Gregorian, year first', () => {
        expect(settingsOf(systemInfoSchema.parse({}))).toEqual({
            calendar: 'gregorian',
            dateFormat: 'YYYY-MM-DD',
        })
    })
})

describe('valuesOf', () => {
    it('maps data elements to values and leaves empty ones out', () => {
        const held = heldEventSchema.parse({
            ...SAVED_VISIT,
            dataValues: [
                ...SAVED_VISIT.dataValues,
                { dataElement: 'labFollowNt', value: '' },
                { dataElement: 'labFollowUp' },
            ],
        })
        expect(valuesOf(held)).toEqual({
            labWeight01: '12',
            labTempC001: '37.2',
            labSexCode1: 'F',
            labPregnant: 'false',
            labOutcome1: 'HOME',
        })
    })
})
