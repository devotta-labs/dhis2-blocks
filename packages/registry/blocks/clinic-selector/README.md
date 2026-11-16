# Clinic Selector

A switcher for the clinic a user is working in, for React 18 applications: a
short list of their own organisation units, with search and a paged list of
every clinic when they have more.
The provider loads the user's units, remembers the current clinic and the
recent ones in the browser, and shares the choice with every page through
`useClinic()`.

```tsx
function ClinicHeader() {
    const { state } = useSidebar()
    return (
        <SidebarHeader>
            <ClinicSelector collapsed={state.collapsed} />
        </SidebarHeader>
    )
}

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <ClinicProvider>
            <SidebarProvider>
                <Sidebar>
                    {/* Before the navigation, which is hidden while collapsed */}
                    <ClinicHeader />
                    <SidebarNavigation>{/* links */}</SidebarNavigation>
                </Sidebar>
                {children}
            </SidebarProvider>
        </ClinicProvider>
    )
}

// in any page under the provider
const { clinic, status } = useClinic()
```

The block does not depend on the sidebar, so the host passes `collapsed`. Pass
`value` and `onValueChange` to `ClinicProvider` to control the choice.
