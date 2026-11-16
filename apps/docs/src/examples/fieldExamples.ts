import { lazy } from 'react'
import type { ExampleDefinition } from './registry'
import fieldDemoSource from './ui/FieldDemo.tsx?raw'
import fieldDensitySource from './ui/FieldDensity.tsx?raw'
import fieldInputSource from './ui/FieldInput.tsx?raw'
import fieldTextareaSource from './ui/FieldTextarea.tsx?raw'
import fieldSelectSource from './ui/FieldSelect.tsx?raw'
import fieldFieldsetSource from './ui/FieldFieldset.tsx?raw'
import fieldCheckboxesSource from './ui/FieldCheckboxes.tsx?raw'
import fieldRadioGroupSource from './ui/FieldRadioGroup.tsx?raw'
import fieldRadioDescriptionSource from './ui/FieldRadioDescription.tsx?raw'
import fieldHorizontalSource from './ui/FieldHorizontal.tsx?raw'
import fieldGroupSeparatorSource from './ui/FieldGroupSeparator.tsx?raw'
import fieldValidationSource from './ui/FieldValidation.tsx?raw'

/** The Field page's examples. */
export const fieldExamples = [
    {
        slug: 'field/demo',
        title: 'Patient registration',
        live: false,
        Component: lazy(() => import('./ui/FieldDemo')),
        source: fieldDemoSource,
        minHeight: 640,
    },
    {
        slug: 'field/density',
        title: 'Regular and compact',
        live: false,
        Component: lazy(() => import('./ui/FieldDensity')),
        source: fieldDensitySource,
        minHeight: 320,
    },
    {
        slug: 'field/input',
        title: 'Phone number',
        live: false,
        Component: lazy(() => import('./ui/FieldInput')),
        source: fieldInputSource,
        minHeight: 160,
    },
    {
        slug: 'field/textarea',
        title: 'Clinical notes',
        live: false,
        Component: lazy(() => import('./ui/FieldTextarea')),
        source: fieldTextareaSource,
        minHeight: 200,
    },
    {
        slug: 'field/select',
        title: 'Visit type',
        live: false,
        Component: lazy(() => import('./ui/FieldSelect')),
        source: fieldSelectSource,
        minHeight: 160,
    },
    {
        slug: 'field/fieldset',
        title: 'Home location',
        live: false,
        Component: lazy(() => import('./ui/FieldFieldset')),
        source: fieldFieldsetSource,
        minHeight: 220,
    },
    {
        slug: 'field/checkboxes',
        title: 'Symptoms',
        live: false,
        Component: lazy(() => import('./ui/FieldCheckboxes')),
        source: fieldCheckboxesSource,
        minHeight: 200,
    },
    {
        slug: 'field/radio-group',
        title: 'Malaria test result',
        live: false,
        Component: lazy(() => import('./ui/FieldRadioGroup')),
        source: fieldRadioGroupSource,
        minHeight: 180,
    },
    {
        slug: 'field/radio-description',
        title: 'TB treatment outcome',
        live: false,
        Component: lazy(() => import('./ui/FieldRadioDescription')),
        source: fieldRadioDescriptionSource,
        minHeight: 240,
    },
    {
        slug: 'field/horizontal',
        title: 'Consent and reminders',
        live: false,
        Component: lazy(() => import('./ui/FieldHorizontal')),
        source: fieldHorizontalSource,
        minHeight: 160,
    },
    {
        slug: 'field/group',
        title: 'Find a person',
        live: false,
        Component: lazy(() => import('./ui/FieldGroupSeparator')),
        source: fieldGroupSeparatorSource,
        minHeight: 240,
    },
    {
        slug: 'field/validation',
        title: 'Weight and test result',
        live: false,
        Component: lazy(() => import('./ui/FieldValidation')),
        source: fieldValidationSource,
        minHeight: 300,
    },
] as const satisfies readonly ExampleDefinition[]
