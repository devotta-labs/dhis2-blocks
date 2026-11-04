import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/dhis2/ui/alert-dialog'
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
import { Field, FieldLabel } from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'

/** A dialog with a short form, and a confirmation before deleting. */
const DialogConfirm = () => (
    <div className="flex flex-wrap gap-2">
        <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
                Rename view
            </DialogTrigger>
            <DialogContent size="sm">
                <DialogHeader>
                    <DialogTitle>Rename view</DialogTitle>
                    <DialogDescription>
                        Everyone who can see this view sees the new name.
                    </DialogDescription>
                </DialogHeader>
                <Field>
                    <FieldLabel htmlFor="view-name">Name</FieldLabel>
                    <Input id="view-name" defaultValue="Due this week" />
                </Field>
                <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                        Cancel
                    </DialogClose>
                    <DialogClose render={<Button />}>Save</DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
                Delete view
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete this view?</AlertDialogTitle>
                    <AlertDialogDescription>
                        The view is removed for everyone. The records in it stay
                        as they are.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive">
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
)

export default DialogConfirm
