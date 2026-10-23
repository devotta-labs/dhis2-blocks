import { describe, expect, it } from 'vitest'
import type { AttributeMetadata } from '../api/schemas'
import { hivProgram } from '../__tests__/fixtures/program'
import {
    attributeOf,
    buildProgramModel,
    searchableAttributes,
} from './programModel'

const model = buildProgramModel(hivProgram)
const attr = (id: string) => {
    const found = attributeOf(model, id)
    if (!found) {
        throw new Error(`missing ${id}`)
    }
    return found
}

describe('buildProgramModel', () => {
    it('carries the program rules and attributes in metadata order', () => {
        expect(model).toMatchObject({
            program: 'hivProgram',
            name: 'HIV Program',
            trackedEntityType: 'personType',
            minAttributes: 2,
            maxResults: 5,
        })
        expect(model.attributes.map((a) => a.id)).toEqual(
            hivProgram.attributes.map((a) => a.id)
        )
    })

    it('maps value types to kinds, option sets first', () => {
        expect(
            ['artNumber', 'sex', 'dob', 'weight', 'visit', 'photo'].map(
                (id) => attr(id).kind
            )
        ).toEqual([
            'text',
            'option',
            'date',
            'number',
            'dateTime',
            'unsupported',
        ])
    })

    it('marks unique-but-not-searchable attributes unusable', () => {
        expect(attr('legacyId').unique).toBe(true)
        expect(attr('legacyId').usable).toBe(false)
        expect(attr('artNumber').usable).toBe(true)
    })

    it('marks unsupported value types unusable', () => {
        expect(attr('photo').usable).toBe(false)
    })

    it('marks a text attribute with every operator blocked unusable', () => {
        expect(attr('nickname').usable).toBe(false)
        expect(attr('nickname').textOperator).toBeUndefined()
    })

    it('uses preferredSearchOperator unless blocked, else like, sw, eq', () => {
        const build = (extra: Partial<AttributeMetadata>) =>
            buildProgramModel({
                ...hivProgram,
                attributes: [
                    {
                        ...hivProgram.attributes[2]!,
                        ...extra,
                    },
                ],
            }).attributes[0]!.textOperator
        expect(build({})).toBe('like')
        expect(build({ preferredSearchOperator: 'sw' })).toBe('sw')
        expect(
            build({
                preferredSearchOperator: 'sw',
                blockedSearchOperators: ['sw'],
            })
        ).toBe('like')
        expect(build({ blockedSearchOperators: ['like', 'sw'] })).toBe('eq')
    })

    it('lists searchable attributes in metadata order', () => {
        expect(searchableAttributes(model).map((a) => a.id)).toEqual([
            'artNumber',
            'firstName',
            'dob',
            'sex',
            'weight',
            'visit',
        ])
    })

    it('returns undefined for an unknown attribute', () => {
        expect(attributeOf(model, 'nope')).toBeUndefined()
    })

    it('freezes the model all the way down', () => {
        expect(Object.isFrozen(model)).toBe(true)
        expect(Object.isFrozen(model.attributes)).toBe(true)
        expect(Object.isFrozen(attr('sex'))).toBe(true)
        expect(Object.isFrozen(attr('sex').options)).toBe(true)
        expect(Object.isFrozen(attr('sex').options?.[0])).toBe(true)
        expect('add' in attr('nickname').blocked).toBe(false)
        expect(attr('nickname').blocked.has('like')).toBe(true)
    })
})
