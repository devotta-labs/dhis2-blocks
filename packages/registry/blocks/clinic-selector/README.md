# Clinic Selector

A switcher for the clinic a user is working in, for React 18 applications: a
short list of their own organisation units, with search when they have more.
The provider loads the user's units, remembers the current clinic and the
recent ones in the browser, and shares the choice with every page through
`useClinic()`.

```tsx
;<SidebarHeader>
    <ClinicProvider>
        <ClinicSelector />
    </ClinicProvider>
</SidebarHeader>

// anywhere under the provider
const { clinic, status } = useClinic()
```

In a sidebar, pass `collapsed={useSidebar().state.collapsed}` to
`ClinicSelector`. Pass `value` and `onValueChange` to `ClinicProvider` to
control the choice.
