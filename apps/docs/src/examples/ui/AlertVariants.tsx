import {
    Alert,
    AlertDescription,
    AlertTitle,
    ErrorAlert,
} from '@/components/dhis2/ui/alert'

/** A message for each kind of news: information, success, warning and error. */
const AlertVariants = () => (
    <div className="flex flex-col gap-3">
        <Alert>
            <AlertTitle>New data is being added</AlertTitle>
            <AlertDescription>
                Figures for this month may still change.
            </AlertDescription>
        </Alert>
        <Alert variant="success">
            <AlertTitle>Enrollment saved</AlertTitle>
        </Alert>
        <Alert variant="warning">
            <AlertTitle>You are offline</AlertTitle>
            <AlertDescription>
                Changes are kept on this device until you are back online.
            </AlertDescription>
        </Alert>
        <ErrorAlert title="The list could not be loaded">
            Check your connection and try again.
        </ErrorAlert>
    </div>
)

export default AlertVariants
