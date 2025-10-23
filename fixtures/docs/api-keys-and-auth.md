# API Keys and Authentication

Nimbus Notes exposes a REST API for reading and writing notes programmatically. All requests must include an API key in the `Authorization: Bearer <key>` header.

## Creating an API key

Go to Settings > Developer > API Keys and click "Generate new key". Keys are shown only once at creation time; if you lose a key you must revoke it and generate a new one. Each workspace can have up to 10 active API keys at once.

## Scopes

API keys can be scoped to `read-only`, `read-write`, or `admin`. Admin-scoped keys can manage other API keys and workspace settings and should be handled with the same care as a password.

## Rotating and revoking keys

You can revoke a key at any time from the same Developer settings page; revocation takes effect within about 60 seconds. We recommend rotating API keys every 90 days as a security best practice, and immediately if a key may have been exposed, for example committed to a public repository.

## OAuth for third-party apps

For building public integrations, use OAuth 2.0 authorization code flow instead of API keys. Register your application at developers.nimbusnotes.example to receive a client ID and secret.
