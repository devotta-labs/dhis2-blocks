# Organisation Unit Switcher

A switcher for the organisation unit a user is working in, such as their
clinic or school, for React 18 applications: a short list of their own units,
with search and a paged list of every unit below them when they have more.
The provider loads the user's units, remembers the current one and the recent
ones in the browser, and shares the choice with every page through
`useOrgUnit()`.

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false)
    return (
        <OrgUnitProvider>
            <aside>
                {/* At the top of the navigation, where it stays while the links collapse */}
                <OrgUnitSwitcher
                    collapsed={collapsed}
                    texts={{
                        label: i18n.t('School'),
                        choose: i18n.t('Choose a school'),
                        changed: (name) =>
                            i18n.t('School changed to {{name}}', {
                                name,
                                interpolation: { escapeValue: false },
                            }),
                    }}
                />
                <nav>{/* links */}</nav>
            </aside>
            {children}
        </OrgUnitProvider>
    )
}

// in any page under the provider
const { orgUnit, status } = useOrgUnit()
```

The block brings no navigation of its own, so the host passes `collapsed`.
Every sentence the switcher shows can be replaced through `texts`; the ones
left out say "organisation unit". Pass `value` and `onValueChange` to
`OrgUnitProvider` to control the choice.
