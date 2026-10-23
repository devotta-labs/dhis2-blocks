import { useState } from 'react'
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
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import { Textarea } from '@/components/dhis2/ui/textarea'

export default function DialogForm() {
    const [open, setOpen] = useState(false)
    const [savedName, setSavedName] = useState('')

    return (
        <div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger render={<Button />}>
                    Create a saved view
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a saved view</DialogTitle>
                        <DialogDescription>
                            Give this set of columns and filters a name.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault()
                            const data = new FormData(event.currentTarget)

                            setSavedName(String(data.get('name')).trim())
                            setOpen(false)
                        }}
                    >
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="view-name">Name</Label>
                                <Input
                                    id="view-name"
                                    name="name"
                                    placeholder="Monthly follow-up"
                                    required
                                    pattern=".*\S.*"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="view-description">
                                    Description
                                </Label>
                                <Textarea
                                    id="view-description"
                                    name="description"
                                    placeholder="Describe when to use this view"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose render={<Button variant="outline" />}>
                                Cancel
                            </DialogClose>
                            <Button type="submit">Save view</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <p role="status" className="mt-3 text-sm text-dhis2-grey-700">
                {savedName && `Saved “${savedName}” in this demo.`}
            </p>
        </div>
    )
}
