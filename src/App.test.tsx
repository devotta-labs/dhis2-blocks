import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'

it('renders the hello message', () => {
    expect(renderToStaticMarkup(<App />)).toContain('Hello!')
})
