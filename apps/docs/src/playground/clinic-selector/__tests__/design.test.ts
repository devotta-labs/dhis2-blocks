import { describe, expect, it } from 'vitest'
import { DESIGN_DEFAULTS, designCss, designSpec } from '../design'

const still = { hovered: false, focused: false }

describe('the clinic selector lab design values', () => {
    it('overrides nothing while every value is the block’s own', () => {
        expect(designCss(DESIGN_DEFAULTS, still)).toBe('')
    })

    it('overrides only what changed, on the real part', () => {
        const css = designCss(
            { ...DESIGN_DEFAULTS, 'trigger.paddingLeft': 12 },
            still
        )
        expect(css).toBe(
            '[data-clinic-selector="trigger"] { padding-left: 12px !important; }'
        )
    })

    it('shows the trigger hovered with the hover background', () => {
        expect(
            designCss(DESIGN_DEFAULTS, { hovered: true, focused: false })
        ).toContain('background-color: #f3f5f7 !important')
    })

    it('lists each change with what it was', () => {
        const spec = designSpec({ ...DESIGN_DEFAULTS, 'tile.size': 32 })
        expect(spec).toContain('Changed from the block as it ships (1):')
        expect(spec).toContain('tile.size: 28px -> 32px')
    })
})
