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

export default function DialogBasic() {
    return (
        <Dialog>
            <DialogTrigger render={<Button />}>
                View export details
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Export ready</DialogTitle>
                    <DialogDescription>
                        Your monthly summary contains 128 records and is ready
                        to download.
                    </DialogDescription>
                </DialogHeader>
                <p className="m-0 text-sm text-dhis2-grey-700">
                    The file includes the columns and filters from your current
                    working list.
                </p>
                <DialogFooter>
                    <DialogClose render={<Button />}>Done</DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
