import { afterEach, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { InstallCommand } from './InstallCommand'

afterEach(() => vi.restoreAllMocks())

it.each(['calendar', 'sidebar', 'button', 'working-list'])(
    'copies real registry item %s for all package managers',
    async (item) => {
        const copy = vi
            .spyOn(navigator.clipboard, 'writeText')
            .mockResolvedValue()
        const view = await render(<InstallCommand item={item} />)
        for (const [manager, command] of [
            ['pnpm', 'pnpm dlx'],
            ['npm', 'npx'],
            ['yarn', 'yarn dlx'],
            ['bun', 'bunx --bun'],
        ]) {
            await view
                .getByRole('button', { name: manager, exact: true })
                .click()
            await view
                .getByRole('button', { name: 'Copy', exact: true })
                .click()
            expect(copy).toHaveBeenLastCalledWith(
                `${command} shadcn@latest add devotta-labs/dhis2-blocks/${item}`
            )
        }
    }
)
