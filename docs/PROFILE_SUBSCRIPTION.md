# User profile and subscription management

The account view is available at `#/profile` (the repository uses a hash router so static hosting needs no path rewrite). Its implementation is in [`src/pages/Profile.jsx`](../src/pages/Profile.jsx), with responsive styles in [`src/pages/Profile.css`](../src/pages/Profile.css) and the page-scoped monochrome theme in [`src/pages/ProfileTheme.css`](../src/pages/ProfileTheme.css).

## Data contract

- [`profile-subscription.schema.json`](./profile-subscription.schema.json) describes the backend response.
- [`profile-subscription.example.json`](./profile-subscription.example.json) is a complete illustrative response and is imported only as the UI's demo fallback.
- Dates use ISO-8601 UTC. The cycle bar shows elapsed percentage and remaining whole days, computed from `currentPeriodStart` and `currentPeriodEnd`.
- `monthlyPrice: null` means the UI does not have a configured public price; it is not treated as zero. Optional `monthlyPriceLabel` and `annualPriceLabel` fields let the UI display proposal text such as `$2,999+` without deriving a price from a client-calculated amount.
- `pricingStatus: "draft"` marks the displayed commercial proposal as illustrative. The sample uses the strategy document's proposed prices: Free, `$499/month` (`$5,000/year`) for Pro, and `$2,999+/month` (`$35,000+/year`) for Enterprise. These are not published offers and no billing is processed by this page.
- A feature may remain a plain string for backwards compatibility or be represented as `{ "label": "…", "status": "available" | "planned" }`. `planned` features are visibly marked in the UI and are not currently offered as implemented capabilities.
- All plan copy and the example identity are illustrative. The user/account API must supply authoritative values and enforce entitlements server-side; do not treat the sample's plan matrix, display-price labels, or feature statuses as payment authorization.

## Component integration

```jsx
<Profile
  data={{ profile, subscription, plans }}
  onProfileSave={async (nextProfile) => api.updateProfile(nextProfile)}
  onLogout={() => auth.signOut()}
  onPlanChange={(plan) => billing.startPlanChange(plan.id)}
/>
```

`data` may be omitted to render the included demo payload. The component calls `onProfileSave(profile)` when the user saves edited name, email, and role; `onLogout()` when Log out is clicked; and `onPlanChange(plan)` when a non-current plan is selected. Callbacks may return a promise and may return `{ ok: false, message }` to show an error. Without a callback, the UI explicitly says no server persistence, logout, or subscription change occurred. No payment is submitted by this page.

A production API should derive the profile from the authenticated session, verify authorization on every write, validate all plan IDs/prices on the server, and launch a provider-hosted checkout/customer portal for paid plan changes. Never trust client-supplied prices or feature lists.
