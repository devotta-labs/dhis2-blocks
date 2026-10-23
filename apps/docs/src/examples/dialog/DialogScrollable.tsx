import { Button } from '@/components/dhis2/ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/dhis2/ui/dialog'

const guidance = [
    {
        title: 'Choose your records',
        text: 'Select the organisation unit, program, and reporting period before creating an export. Only records matching the active filters will be included.',
    },
    {
        title: 'Review the columns',
        text: 'Include the information your team needs and remove columns that are not relevant. The export uses the same column order as your working list.',
    },
    {
        title: 'Check access permissions',
        text: 'Your access rights apply to every exported record. A colleague with different access may see a different record count for the same saved view.',
    },
    {
        title: 'Protect personal information',
        text: 'Export personal information only when needed for your task. Keep files in approved storage and follow your organisation’s retention policy.',
    },
    {
        title: 'Confirm the file format',
        text: 'Check how your spreadsheet application handles dates, identifiers, and leading zeroes. Preserve identifiers as text when importing the file.',
    },
    {
        title: 'Share with your team',
        text: 'Use an approved sharing channel and confirm the recipients before sending the file. Share a saved view instead when colleagues need up-to-date data.',
    },
]

export default function DialogScrollable() {
    return (
        <Dialog>
            <DialogTrigger render={<Button />}>
                Read export guidance
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-2rem)]">
                <DialogHeader>
                    <DialogTitle>Before you export</DialogTitle>
                    <DialogDescription>
                        Review these steps before sharing your data.
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto pr-3">
                    {guidance.map(({ title, text }) => (
                        <section key={title} className="mb-5 last:mb-0">
                            <h3 className="m-0 text-sm font-medium">{title}</h3>
                            <p className="mt-2 mb-0 text-sm leading-6 text-dhis2-grey-700">
                                {text}
                            </p>
                        </section>
                    ))}
                </div>
                <DialogFooter>
                    <DialogClose render={<Button />}>Understood</DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
