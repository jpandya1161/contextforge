# Two-Factor Authentication (2FA)

## Enabling 2FA

Go to Settings > Account > Security and click "Enable two-factor authentication". Nimbus Notes supports authenticator apps (TOTP, such as Google Authenticator or Authy) and SMS codes. Authenticator apps are recommended over SMS since SMS can be intercepted via SIM-swap attacks.

## Backup codes

When you enable 2FA you're given 10 single-use backup codes. Store them somewhere safe outside Nimbus Notes; each code can be used once if you lose access to your authenticator device, and you can regenerate a new set at any time from the same Security settings page, which invalidates the old set.

## Losing access to your 2FA device

If you lose your device and have no backup codes, contact support with proof of account ownership (billing receipt, workspace admin confirmation). Manual 2FA resets typically take 1-2 business days for identity verification.

## Enforcing 2FA for a workspace

Business plan admins can require all members to enable 2FA under Settings > Workspace > Security Policy. Members without 2FA enabled are prompted to set it up on their next login and are logged out if they don't within 7 days.
