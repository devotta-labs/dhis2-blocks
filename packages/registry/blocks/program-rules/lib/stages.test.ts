import { programMetadata, rule } from '../__tests__/metadata'
import { RMNCH, rmnchMetadata } from '../__tests__/rmnch'
import { metadataForStage } from './stages'

describe('metadataForStage', () => {
    it('keeps program-wide rules and the stage’s own rules', () => {
        const metadata = rmnchMetadata()
        const forStage = metadataForStage(metadata, RMNCH.stageId)
        expect(
            forStage.rules.every(
                (r) =>
                    r.programStageId === undefined ||
                    r.programStageId === RMNCH.stageId
            )
        ).toBe(true)
        expect(forStage.rules.length).toBeGreaterThan(0)
        expect(forStage.variables).toBe(metadata.variables)
    })

    it('drops the rules of other stages', () => {
        const metadata = programMetadata({
            rules: [
                rule('wide', 'true', []),
                rule('here', 'true', [], { programStageId: 'stage' }),
                rule('there', 'true', [], { programStageId: 'other' }),
            ],
        })
        const ids = metadataForStage(metadata, 'stage').rules.map((r) => r.id)
        expect(ids).toEqual(['wide', 'here'])
    })
})
