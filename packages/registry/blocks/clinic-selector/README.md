# Clinic Selector

A switcher for the clinic a user is working in, for React 18 applications: a
short list of their own organisation units, with search and a paged list of
every clinic when they have more.
The provider loads the user's units, remembers the current clinic and the
recent ones in the browser, and shares the choice with every page through
`useClinic()`.

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)
    return (
        <ClinicProvider>
            <aside>
                {/* At the top of the navigation, where it stays while the links collapse */}
                <ClinicSelector collapsed={collapsed} />
                <nav>{/* links */}</nav>
            </aside>
            {children}
        </ClinicProvider>
    )
}

// in any page under the provider
const { clinic, status } = useClinic()
```

The block brings no navigation of its own, so the host passes `collapsed`. Pass
`value` and `onValueChange` to `ClinicProvider` to control the choice.
