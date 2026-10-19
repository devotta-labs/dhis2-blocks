import { cn } from './cn'

test('a later class overrides a DHIS2 radius or shadow token', () => {
    expect(cn('rounded-dhis2-sm', 'rounded-none')).toBe('rounded-none')
    expect(cn('rounded-dhis2-md', 'rounded-full')).toBe('rounded-full')
    expect(cn('shadow-dhis2-popover', 'shadow-none')).toBe('shadow-none')
    expect(cn('shadow-dhis2-card', 'shadow-dhis2-popover')).toBe(
        'shadow-dhis2-popover'
    )
})
