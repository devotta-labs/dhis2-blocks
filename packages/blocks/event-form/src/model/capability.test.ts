import { ProgramResponseSchema, toStageMetadata } from '../api/schemas'
import stageFixture from '../api/__fixtures__/rmnch-stage.json'
import { dataElement, stageMetadata } from './__fixtures__/builders'
import { canUseEventForm } from './capability'

describe('canUseEventForm', () => {
    it('refuses a polygon stage', () => {
        expect(
            canUseEventForm(
                stageMetadata([dataElement('a')], { featureType: 'POLYGON' })
            )
        ).toEqual({ ok: false, reason: 'polygon' })
    })

    it('refuses a program with a category combination', () => {
        expect(
            canUseEventForm(
                stageMetadata([dataElement('a')], { hasCategoryCombo: true })
            )
        ).toEqual({ ok: false, reason: 'categoryCombo' })
    })

    it('accepts the RMNCH stage', () => {
        const metadata = toStageMetadata(
            ProgramResponseSchema.parse(stageFixture),
            'WZbXY0S00lP'
        ).unwrap()
        expect(canUseEventForm(metadata)).toEqual({ ok: true })
    })

    it('accepts unsupported value types, which render read-only', () => {
        expect(
            canUseEventForm(
                stageMetadata([dataElement('a', { valueType: 'IMAGE' })])
            )
        ).toEqual({ ok: true })
    })
})
