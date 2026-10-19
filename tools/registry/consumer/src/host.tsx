import { Button } from '@/components/ui/button'

// `text-dhis2-primary` is the check's own use of a DHIS2 utility, so the
// emitted-CSS assertion does not depend on which utilities an item happens to use.
export function Host() {
    return (
        <div
            className="bg-blue-500 rounded-sm text-dhis2-primary"
            data-testid="host"
        >
            <Button variant="link">Host button</Button>
        </div>
    )
}
