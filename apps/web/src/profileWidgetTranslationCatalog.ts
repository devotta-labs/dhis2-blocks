import i18n from '@dhis2/d2-i18n'

// Extraction markers for the source-installed profile widget's default copy.
export const profileWidgetTranslationCatalog = () => [
    // Data: title, terminology, permission reasons and formatted values
    i18n.t('Profile'),
    i18n.t('{{trackedEntityTypeName}} profile', {
        trackedEntityTypeName: '',
    }),
    i18n.t('attributes'),
    i18n.t('enrollments'),
    i18n.t('events'),
    i18n.t('You do not have access to delete this {{trackedEntityTypeName}}', {
        trackedEntityTypeName: '',
    }),
    i18n.t('Yes'),
    i18n.t('No'),
    // Frame, fields and menu
    i18n.t('Collapse'),
    i18n.t('Expand'),
    i18n.t('More actions'),
    i18n.t('Polygon'),
    i18n.t('Lat'),
    i18n.t('Long'),
    i18n.t('File'),
    // Status dialog
    i18n.t('Activate {{trackedEntityTypeName}}', { trackedEntityTypeName: '' }),
    i18n.t('Deactivate {{trackedEntityTypeName}}', {
        trackedEntityTypeName: '',
    }),
    i18n.t(
        'Are you sure you want to activate this {{trackedEntityTypeName}}? This will change its status to active and write operations will be allowed.',
        { trackedEntityTypeName: '' }
    ),
    i18n.t(
        'Are you sure you want to deactivate this {{trackedEntityTypeName}}? This will change its status to inactive and only read operations will be allowed.',
        { trackedEntityTypeName: '' }
    ),
    i18n.t('Yes, activate {{trackedEntityTypeName}}', {
        trackedEntityTypeName: '',
    }),
    i18n.t('Yes, deactivate {{trackedEntityTypeName}}', {
        trackedEntityTypeName: '',
    }),
    i18n.t('There was a problem activating the {{trackedEntityTypeName}}', {
        trackedEntityTypeName: '',
    }),
    i18n.t('There was a problem deactivating the {{trackedEntityTypeName}}', {
        trackedEntityTypeName: '',
    }),
    // Delete dialog
    i18n.t('Delete {{trackedEntityTypeName}}', { trackedEntityTypeName: '' }),
    i18n.t(
        'Are you sure you want to delete this {{trackedEntityTypeName}}? This will permanently remove the {{trackedEntityTypeName}} and all its associated {{enrollmentsLabel}} and {{eventsLabel}} in all programs.',
        { trackedEntityTypeName: '', enrollmentsLabel: '', eventsLabel: '' }
    ),
    i18n.t('Yes, delete {{trackedEntityTypeName}}', {
        trackedEntityTypeName: '',
    }),
    i18n.t('There was a problem deleting the {{trackedEntityTypeName}}', {
        trackedEntityTypeName: '',
    }),
    i18n.t('No, cancel'),
    // Changelog
    i18n.t('Changelog'),
    i18n.t('Date'),
    i18n.t('User'),
    i18n.t('Data item'),
    i18n.t('Change'),
    i18n.t('Value'),
    i18n.t('Previous value'),
    i18n.t('New value'),
    i18n.t('Created'),
    i18n.t('Updated'),
    i18n.t('Deleted'),
    i18n.t('Image'),
    i18n.t('Show all'),
    i18n.t('No changes to display'),
    i18n.t('Loading changelog'),
    i18n.t('The changelog could not be loaded'),
    i18n.t('Try again'),
    i18n.t('Previous page'),
    i18n.t('Next page'),
    i18n.t('Close'),
]
