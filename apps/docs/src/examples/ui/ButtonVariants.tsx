import { Button } from '@/components/dhis2/ui/button'

const ButtonVariants = () => (
    <div className="flex flex-wrap items-center gap-2">
        <Button>Save</Button>
        <Button variant="outline">Cancel</Button>
        <Button variant="secondary">Export</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="ghost">Show more</Button>
        <Button variant="link">View details</Button>
        <Button disabled>Saving…</Button>
    </div>
)

export default ButtonVariants
