import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    ProfileWidget,
    ProfileWidgetContent,
    ProfileWidgetHeader,
    ProfileWidgetHeaderActions,
    ProfileWidgetTitle,
    ProfileWidgetToggle,
} from '@/components/profile-widget'

/**
 * Loading placeholders for the Profile Widget examples.
 *
 * These belong to the docs, not the block: they cover the time before the
 * example can mount at all — its code loading and the adapter starting the
 * DHIS2 session. The widget's frame is presentational and needs no data, so
 * they render the real frame with the examples' own loading spinner, and the
 * preview does not change layout when the example takes over. If an
 * example's loading state changes, update its placeholder to match.
 */
const ProfileWidgetPlaceholder = ({
    title,
    toggle,
    visit = false,
    className,
}: {
    title: string
    toggle: boolean
    /** The visit example loads its event section separately. */
    visit?: boolean
    className?: string
}) => (
    <div aria-busy="true">
        <ProfileWidget className={className}>
            <ProfileWidgetHeader>
                <ProfileWidgetTitle>{title}</ProfileWidgetTitle>
                {toggle && (
                    <ProfileWidgetHeaderActions>
                        <ProfileWidgetToggle disabled />
                    </ProfileWidgetHeaderActions>
                )}
            </ProfileWidgetHeader>
            <ProfileWidgetContent>
                <Spinner
                    className="size-6 border-4"
                    aria-label="Loading profile"
                />
                {visit && <Spinner aria-label="Loading visit" />}
            </ProfileWidgetContent>
        </ProfileWidget>
    </div>
)

export const ProfileWidgetEnrollmentPlaceholder = () => (
    <ProfileWidgetPlaceholder title="Profile" toggle className="max-w-md" />
)

export const ProfileWidgetVisitPlaceholder = () => (
    <ProfileWidgetPlaceholder
        title="Profile"
        toggle={false}
        visit
        className="max-w-xl"
    />
)

export const ProfileWidgetToolbarPlaceholder = () => (
    <div className="max-w-md">
        <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
            <h2 className="m-0 text-base font-medium">Tracked entity</h2>
        </div>
        <ProfileWidgetPlaceholder title="Profile" toggle />
    </div>
)
