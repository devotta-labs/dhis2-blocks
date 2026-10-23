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

const summary = [
    { facility: 'Central Clinic', records: 52, complete: 48, pending: 4 },
    { facility: 'East Health Centre', records: 31, complete: 25, pending: 6 },
    { facility: 'North Clinic', records: 45, complete: 42, pending: 3 },
]

export default function DialogWide() {
    return (
        <Dialog>
            <DialogTrigger render={<Button />}>
                Preview monthly summary
            </DialogTrigger>
            <DialogContent className="top-16 max-h-[calc(100dvh-5rem)] translate-y-0 sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Monthly summary</DialogTitle>
                    <DialogDescription>
                        Sample totals for three facilities in the reporting
                        period.
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 overflow-auto">
                    <table className="w-full border-collapse text-left text-sm">
                        <caption className="sr-only">
                            Sample facility totals
                        </caption>
                        <thead>
                            <tr className="border-b border-dhis2-grey-400">
                                <th scope="col" className="p-3">
                                    Facility
                                </th>
                                <th scope="col" className="p-3 text-right">
                                    Records
                                </th>
                                <th scope="col" className="p-3 text-right">
                                    Complete
                                </th>
                                <th scope="col" className="p-3 text-right">
                                    Pending
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.map(
                                ({ facility, records, complete, pending }) => (
                                    <tr
                                        key={facility}
                                        className="border-b border-dhis2-grey-300"
                                    >
                                        <th
                                            scope="row"
                                            className="p-3 font-normal"
                                        >
                                            {facility}
                                        </th>
                                        <td className="p-3 text-right tabular-nums">
                                            {records}
                                        </td>
                                        <td className="p-3 text-right tabular-nums">
                                            {complete}
                                        </td>
                                        <td className="p-3 text-right tabular-nums">
                                            {pending}
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
                <DialogFooter>
                    <DialogClose render={<Button />}>Close summary</DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
