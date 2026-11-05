import { Button } from '@/components/dhis2/ui/button'
import { Spinner } from '@/components/dhis2/ui/spinner'

const SpinnerSizes = () => (
    <div className="flex flex-wrap items-center gap-6">
        <Spinner />
        <Spinner className="size-6 border-4" />
        <Spinner className="size-12 border-6" />
        <Button disabled>
            <Spinner aria-hidden />
            Saving…
        </Button>
    </div>
)

export default SpinnerSizes
