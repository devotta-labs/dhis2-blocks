import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OptionLabel } from './OptionLabel'

describe('OptionLabel', () => {
    it('renders host-resolved icon markup', () => {
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

        expect(markup).toContain('src="/icons/medicine/icon.svg"')
        expect(markup).toContain('Malaria case registration')
    })
})
