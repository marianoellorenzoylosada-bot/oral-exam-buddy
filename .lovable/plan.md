## MVP: Auto-confirm sign-ups (TEMPORARY)

### Status: ENABLED (MVP testing only)

Auth setting `auto_confirm_email = true` was applied via Lovable Cloud auth config. New sign-ups can log in immediately without clicking a verification email.

### Why
The project has no custom email sender domain, so auth emails are sent through the default shared sender. Hotmail/Outlook silently drop most of these messages, blocking testers at sign-up.

### Scope of change
- Auth config flag only. No code changes.
- Auth UI, password reset flow, routing, RLS, and email templates are untouched.
- Password reset still sends a real email (works for Gmail; unreliable for Hotmail until a sender domain is configured).

### How to revert before production
Two options:

1. **Via the agent**: ask "Disable auto-confirm email for sign-ups." The agent will call the auth config tool with `auto_confirm_email: false`.
2. **Manually**: open Cloud → Users → Auth Settings (gear icon) → Email settings → turn OFF "Auto-confirm email".

### Recommended next step before production
Set up a Lovable Email sender domain (Cloud → Emails). This restores proper email verification and fixes Hotmail/Outlook deliverability for both sign-up and password reset. Once the domain is verified, re-enable email confirmation by reverting this flag.
