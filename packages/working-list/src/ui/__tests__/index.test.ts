import { readFileSync } from 'node:fs'

const packageSurface = readFileSync(require.resolve('../index'), 'utf8')

describe('working-list package UI surface', () => {
    it('exports the self-contained component and translation provider', () => {
        expect(packageSurface).toContain(
            "export { WorkingList, type WorkingListProps } from './WorkingList'"
        )
        expect(packageSurface).toContain('WorkingListQueryBoundary,')
        expect(packageSurface).toContain("from './WorkingListQueryBoundary'")
        expect(packageSurface).toContain('WorkingListTextProvider')
        expect(packageSurface).toContain('createWorkingListQueryClient')
    })
})
