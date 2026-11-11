import { describe, expect, it } from 'vitest'
import { hivProgram } from '../__tests__/fixtures/program'
import { buildProgramModel } from '../rules/programModel'
import { TrackedEntitiesResponseSchema } from './schemas'
import { toSearchOutcome } from './search'

const model = buildProgramModel(hivProgram)
const uncapped = buildProgramModel({ ...hivProgram, maxTeiCountToReturn: 0 })

const entity = (id: string) => ({
    trackedEntity: id,
    trackedEntityType: 'personType',
    orgUnit: 'ouA',
    programOwners: [
        { orgUnit: 'ouOther', program: 'otherProgram' },
        { orgUnit: 'ouOwner', program: 'hivProgram' },
    ],
    attributes: [{ attribute: 'artNumber', value: 'A1' }],
})

const ids = (count: number) =>
    Array.from({ length: count }, (_, index) => entity(`te${index}`))

/** A page of `count` rows as the server sends it, with or without a total. */
const rows = (count: number, total?: number) =>
    TrackedEntitiesResponseSchema.parse(
        total === undefined
            ? { trackedEntities: ids(count) }
            : { trackedEntities: ids(count), pager: { total } }
    )

describe('toSearchOutcome', () => {
    it('returns too-many over the cap and shows no one', () => {
        expect(toSearchOutcome(model, rows(6, 6), 1)).toEqual({
            kind: 'too-many',
        })
    })

    it('treats cap 0 as no cap', () => {
        expect(toSearchOutcome(uncapped, rows(10, 500), 1).kind).toBe('results')
    })

    it.each([6, 10])(
        'hides %i rows without a total when the cap is 5',
        (count) => {
            expect(toSearchOutcome(model, rows(count), 1)).toEqual({
                kind: 'too-many',
            })
        }
    )

    it('hides an indeterminate count even when a full page fits under the cap', () => {
        const capped = buildProgramModel({
            ...hivProgram,
            maxTeiCountToReturn: 15,
        })
        expect(toSearchOutcome(capped, rows(10), 1)).toEqual({
            kind: 'too-many',
        })
    })

    it('accepts a short first page within the cap without a total', () => {
        expect(toSearchOutcome(model, rows(5), 1)).toMatchObject({
            kind: 'results',
            hasNext: false,
        })
        expect(toSearchOutcome(model, rows(5), 2)).toEqual({
            kind: 'too-many',
        })
    })

    it('picks the program owner for the program', () => {
        expect(toSearchOutcome(model, rows(1, 1), 1)).toMatchObject({
            kind: 'results',
            people: [
                {
                    trackedEntity: 'te0',
                    programOwner: 'ouOwner',
                    attributes: { artNumber: 'A1' },
                },
            ],
        })
    })

    it('works out hasNext with and without a total', () => {
        expect(toSearchOutcome(uncapped, rows(3, 11), 1)).toMatchObject({
            hasNext: true,
        })
        expect(toSearchOutcome(uncapped, rows(3, 20), 2)).toMatchObject({
            hasNext: false,
        })
        expect(toSearchOutcome(uncapped, rows(10), 1)).toMatchObject({
            hasNext: true,
        })
        expect(toSearchOutcome(uncapped, rows(9), 1)).toMatchObject({
            hasNext: false,
        })
    })
})
