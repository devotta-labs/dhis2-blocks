import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import { OrganisationUnitSelectorContent } from '../OrganisationUnitSelectorContent'

const Harness = () => {
    const [search, setSearch] = useState('')
    return (
        <OrganisationUnitSelectorContent
            roots={[]}
            allowedPaths={[]}
            searchValue={search}
            treeKey="search-Ngelehun"
            onSearchChange={setSearch}
            searchLoading
            onSelect={() => undefined}
        />
    )
}

describe('Capture-style organisation-unit field', () => {
    it('matches the field, search header, input and tree-shell geometry', async () => {
        const screen = await render(<Harness />)
        const input = screen.getByPlaceholder('Search')
        await expect.element(input).toBeVisible()
        const initialInputBorderColor = getComputedStyle(
            input.element()
        ).borderColor
        const initialInputBoxShadow = getComputedStyle(
            input.element()
        ).boxShadow
        await input.fill('Ngelehun')
        await expect.element(input).toHaveValue('Ngelehun')

        const field = input.element().parentElement?.parentElement
        const searchHeader = input.element().parentElement
        const tree = screen.getByTestId('org-unit-tree').element()
        const fieldStyle = getComputedStyle(field!)
        const headerStyle = getComputedStyle(searchHeader!)
        const inputStyle = getComputedStyle(input.element())
        const treeStyle = getComputedStyle(tree)
        const loader = tree.querySelector<HTMLElement>('[data-slot="spinner"]')
        const loaderStyle = getComputedStyle(loader!)

        expect(fieldStyle.borderWidth).toBe('1px')
        expect(fieldStyle.borderColor).toBe('rgb(232, 237, 242)')
        expect(fieldStyle.borderRadius).toBe('3px')
        expect(fieldStyle.backgroundColor).toBe('rgb(255, 255, 255)')
        expect(headerStyle.padding).toBe('8px')
        expect(headerStyle.backgroundColor).toBe('rgb(248, 249, 250)')
        expect(inputStyle.height).toBe('40px')
        expect(inputStyle.borderWidth).toBe('1px')
        expect(initialInputBorderColor).toBe('rgb(160, 173, 186)')
        expect(inputStyle.borderRadius).toBe('3px')
        expect(initialInputBoxShadow).toBe(
            'rgba(48, 54, 60, 0.1) 0px 0px 1px 0px inset'
        )
        expect(inputStyle.borderColor).toBe('rgb(20, 124, 215)')
        expect(inputStyle.boxShadow).toBe(
            'rgb(20, 124, 215) 0px 0px 0px 2px inset'
        )
        expect(treeStyle.display).toBe('flex')
        expect(treeStyle.alignItems).toBe('center')
        expect(treeStyle.justifyContent).toBe('center')
        expect(treeStyle.height).toBe(`${window.innerHeight - 48}px`)
        expect(treeStyle.marginTop).toBe('4px')
        expect(treeStyle.marginRight).toBe('4px')
        expect(treeStyle.marginBottom).toBe('4px')
        expect(treeStyle.marginLeft).toBe('4px')
        expect(loaderStyle.width).toBe('48px')
        expect(loaderStyle.height).toBe('48px')
        expect(loaderStyle.borderWidth).toBe('6px')
    })
})
