import { describe, expect, test } from 'vitest'
import { layout as cohortAnc } from '../../../../../apps/docs/src/examples/tracker-data-entry/CohortAncRegister'
import { layout as immunisation } from '../../../../../apps/docs/src/examples/tracker-data-entry/ImmunisationRegister'
import immunisationProgram from './__tests__/fixtures/immunisation-program.json'
import rmnchProgram from './__tests__/fixtures/rmnch-register-program.json'
import { compileLayout } from './compileLayout'
import { registerLayoutSchema } from './layout'
import { registerMetadataOf, registerProgramSchema } from './metadata'

// The docs examples are the paper registers people copy: each must be a layout its program can take.
describe('the docs examples', () => {
    test.each([
        ['immunisation', immunisation, immunisationProgram, 13],
        ['cohort ANC', cohortAnc, rmnchProgram, 41],
    ])('%s compiles', (_name, layout, program, columns) => {
        const result = compileLayout(
            registerLayoutSchema.parse(layout),
            registerMetadataOf(registerProgramSchema.parse(program))
        )
        expect(result).toMatchObject({ ok: true })
        expect(result.ok && result.compiled.columns).toHaveLength(columns)
    })
})
