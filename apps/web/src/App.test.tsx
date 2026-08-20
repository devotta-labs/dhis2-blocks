import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'
import {
    isGuardedAppUrlTransition,
    parseAppUrlState,
    serializeAppUrlState,
} from './app/urlState'

jest.mock('./app/AppShell', () => ({
    AppShell: () => (
        <main aria-label="Working lists" data-testid="working-list-app">
            Working lists
        </main>
    ),
}))

describe('application entry point', () => {
    it('renders an accessible application landmark', () => {
        const markup = renderToStaticMarkup(<App />)

        expect(markup).toContain('<main')
        expect(markup).toContain('aria-label="Working lists"')
    })
})

describe('URL state privacy boundary', () => {
    it('serializes only context, selected view, and pagination preferences', () => {
        expect(
            serializeAppUrlState({
                programId: 'IpHINAT79UW',
                orgUnitId: 'DiszpKrYNg8',
                selectedTemplateId: 'active',
                page: 2,
                pageSize: 25,
            })
        ).toBe(
            'programId=IpHINAT79UW&orgUnitId=DiszpKrYNg8&selectedTemplateId=active&page=2&pageSize=25'
        )
    })

    it('ignores filter values and unknown keys from a tampered URL', () => {
        const parsed = parseAppUrlState(
            new URLSearchParams(
                'programId=IpHINAT79UW&filter=firstName%3ATest&token=secret'
            )
        )

        expect(parsed).toEqual({ programId: 'IpHINAT79UW' })
        expect(JSON.stringify(parsed)).not.toContain('Test')
        expect(JSON.stringify(parsed)).not.toContain('secret')
    })

    it('fails fast when a known URL preference is malformed', () => {
        expect(() =>
            parseAppUrlState(
                new URLSearchParams('programId=IpHINAT79UW&page=-1')
            )
        ).toThrow()
    })

    it('fails fast for duplicate or blank known URL parameters', () => {
        expect(() =>
            parseAppUrlState(new URLSearchParams('programId=one&programId=two'))
        ).toThrow()
        expect(() =>
            parseAppUrlState(new URLSearchParams('orgUnitId='))
        ).toThrow()
    })

    it('guards external program and list changes, but not OU or paging', () => {
        const current = {
            programId: 'Program0001',
            orgUnitId: 'OrgUnit0001',
            selectedTemplateId: 'List0000001',
            page: 1,
            pageSize: 15,
        }

        expect(
            isGuardedAppUrlTransition(current, {
                ...current,
                programId: 'Program0002',
            })
        ).toBe(true)
        expect(
            isGuardedAppUrlTransition(current, {
                ...current,
                selectedTemplateId: 'List0000002',
            })
        ).toBe(true)
        expect(
            isGuardedAppUrlTransition(current, {
                ...current,
                orgUnitId: 'OrgUnit0002',
                page: 4,
                pageSize: 50,
            })
        ).toBe(false)
    })
})
