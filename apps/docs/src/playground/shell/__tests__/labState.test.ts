import { describe, expect, it } from 'vitest'
import { initialLabState, labReducer } from '../labState'

describe('the shell lab state', () => {
    it('opens on the app with mixed density', () => {
        expect(initialLabState()).toMatchObject({
            example: 'App',
            density: 'mixed',
        })
    })

    it('opens on the linked example, and on the app for an unknown one', () => {
        expect(initialLabState('Section').example).toBe('Section')
        expect(initialLabState('Nope').example).toBe('App')
    })

    it('keeps the density and width when another example is picked', () => {
        const dense = labReducer(
            labReducer(initialLabState(), {
                type: 'changeDensity',
                density: 'comfortable',
            }),
            { type: 'changeWidth', width: 'phone' }
        )
        expect(
            labReducer(dense, { type: 'pickExample', example: 'Toolbar' })
        ).toMatchObject({
            example: 'Toolbar',
            density: 'comfortable',
            width: 'phone',
        })
    })
})
