import { cn } from './cn'

describe('cn', () => {
    it('lets a caller colour win without dropping the font size', () => {
        expect(
            cn('text-sm text-dhis2-muted-foreground', 'text-dhis2-foreground')
        ).toBe('text-sm text-dhis2-foreground')
    })

    it('lets a caller border colour win', () => {
        expect(
            cn('border-dhis2-input', 'border-dhis2-destructive-border')
        ).toBe('border-dhis2-destructive-border')
    })
})
