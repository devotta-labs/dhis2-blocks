import { describe, expect, it } from 'vitest'
import { hivProgram } from '../__tests__/fixtures/program'
import { buildProgramModel } from './programModel'
import { PAGE_SIZE, serializeFilter, toSearchParams } from './searchParams'
import { seal } from './seal'

const model = buildProgramModel(hivProgram)

describe('serializeFilter', () => {
    it('escapes : , / in values', () => {
        expect(
            serializeFilter({
                attribute: 'artNumber',
                conditions: [{ op: 'eq', value: 'ART:1,2/3' }],
            })
        ).toBe('artNumber:eq:ART/:1/,2//3')
    })

    it('chains the codes of a multi-select, which DHIS2 ANDs', () => {
        expect(
            serializeFilter({
                attribute: 'allergies',
                conditions: [
                    { op: 'eq', value: 'PEN' },
                    { op: 'eq', value: 'SULFA' },
                ],
            })
        ).toBe('allergies:eq:PEN:eq:SULFA')
    })

    it('joins several conditions on one attribute', () => {
        expect(
            serializeFilter({
                attribute: 'weight',
                conditions: [
                    { op: 'ge', value: '5' },
                    { op: 'le', value: '9' },
                ],
            })
        ).toBe('weight:ge:5:le:9')
    })
})

describe('toSearchParams', () => {
    it('sends orgUnitMode ACCESSIBLE and no orgUnits', () => {
        const params = toSearchParams(
            model,
            seal([
                {
                    attribute: 'artNumber',
                    conditions: [{ op: 'eq', value: 'A1' }],
                },
            ]),
            2
        )
        expect(params).toEqual({
            program: 'hivProgram',
            filter: ['artNumber:eq:A1'],
            orgUnitMode: 'ACCESSIBLE',
            page: 2,
            pageSize: PAGE_SIZE,
            totalPages: true,
            fields: 'trackedEntity,trackedEntityType,orgUnit,programOwners[orgUnit,program],attributes[attribute,value]',
        })
        expect(params).not.toHaveProperty('orgUnits')
    })
})

describe('toSearchParams without a program', () => {
    it('sends the tracked entity type instead of a program', () => {
        const { program: _program, ...type } = hivProgram
        const params = toSearchParams(
            buildProgramModel(type),
            seal([
                {
                    attribute: 'firstName',
                    conditions: [{ op: 'like', value: 'Amina' }],
                },
            ]),
            1
        )
        expect(params).toMatchObject({
            trackedEntityType: 'personType',
            filter: ['firstName:like:Amina'],
        })
        expect(params).not.toHaveProperty('program')
    })
})
