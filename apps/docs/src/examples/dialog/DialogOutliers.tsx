import type { ReactNode } from 'react'
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

const identifier = `record_${'0123456789abcdef'.repeat(16)}`

function Outlier({ title, children }: { title: string; children: ReactNode }) {
    return (
        <Dialog>
            <DialogTrigger render={<Button />}>{title}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Default width and placement, with no DialogContent
                        overrides. Press Escape to close if content goes
                        offscreen.
                    </DialogDescription>
                </DialogHeader>
                {children}
                <DialogFooter>
                    <DialogClose render={<Button />}>Close example</DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function WideTable() {
    return (
        <table className="w-[960px] table-fixed border-collapse text-left text-sm">
            <caption className="sr-only">960px-wide sample report</caption>
            <thead>
                <tr>
                    {[
                        'Facility',
                        'Program',
                        'Period',
                        'Records',
                        'Last updated',
                    ].map((heading) => (
                        <th key={heading} scope="col" className="border p-3">
                            {heading}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                <tr>
                    {[
                        'Central Clinic',
                        'Child health',
                        'October 2026',
                        '128',
                        '23 October',
                    ].map((value) => (
                        <td key={value} className="border p-3">
                            {value}
                        </td>
                    ))}
                </tr>
            </tbody>
        </table>
    )
}

export default function DialogOutliers() {
    return (
        <div className="flex flex-wrap gap-3">
            <Outlier title="Wide table: raw">
                <WideTable />
            </Outlier>
            <Outlier title="Wide table: scrollable">
                <div
                    className="overflow-x-auto"
                    role="region"
                    aria-label="Scrollable sample report"
                    tabIndex={0}
                >
                    <WideTable />
                </div>
            </Outlier>
            <Outlier title="Unbroken text: raw">
                <p className="m-0 font-mono text-sm">{identifier}</p>
            </Outlier>
            <Outlier title="Unbroken text: wrapped">
                <p className="m-0 font-mono text-sm [overflow-wrap:anywhere]">
                    {identifier}
                </p>
            </Outlier>
            <Outlier title="Tall content: raw">
                <div className="space-y-4 text-sm">
                    {Array.from({ length: 30 }, (_, index) => (
                        <p key={index}>
                            Section {index + 1}: This deliberately oversized
                            example has no height limit or scroll container.
                            Compare it with the scrollable guidance example.
                        </p>
                    ))}
                </div>
            </Outlier>
        </div>
    )
}
