# Login Troubleshooting

## Forgot password

Click "Forgot password" on the login page and enter your account email. A reset link is sent immediately and expires after 1 hour. If you don't receive the email within a few minutes, check your spam folder, then contact support if it still hasn't arrived.

## "Too many login attempts" error

After 5 failed login attempts within 15 minutes, the account is temporarily locked for 15 minutes as a brute-force protection measure. Waiting out the lockout is the only way to regain access immediately; support cannot lift it early for security reasons.

## Magic link not arriving

If you signed up using a magic link (passwordless) login and the email isn't arriving, verify the email address was typed correctly and that your organization's email filters allow mail from nimbusnotes.example. Magic links expire after 15 minutes.

## Single sign-on (SSO) issues

Business plan workspaces using SAML SSO should contact their workspace admin first, since SSO configuration errors (wrong entity ID, certificate mismatch) are the most common cause of login failures for SSO users, not an account-level issue.
