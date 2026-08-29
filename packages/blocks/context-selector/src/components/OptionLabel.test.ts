import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OptionLabel } from './OptionLabel'

describe('OptionLabel', () => {
    it('renders Capture-sized host-resolved icon markup', () => {
        const markup = renderToStaticMarkup(
            React.createElement(OptionLabel, {
                label: 'Malaria case registration',
                icon: {
                    source: '/icons/medicine/icon.svg',
                    color: '#1976d2',
                    alternativeText: 'medicine',
                },
            })
        )

        expect(markup).toContain('h-[22px] w-[22px]')
        expect(markup).toContain('rounded-[2px]')
        expect(markup).toContain('pe-[5px]')
        expect(markup).toContain('background-color:#1976d2')
        expect(markup).toContain('src="/icons/medicine/icon.svg"')
        expect(markup).toContain('Malaria case registration')
    })
})
