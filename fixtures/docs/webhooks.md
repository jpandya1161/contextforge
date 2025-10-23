# Webhooks

Webhooks let your server receive a real-time HTTP POST whenever something happens in a Nimbus Notes workspace, instead of polling the API.

## Setting up a webhook

Go to Settings > Developer > Webhooks and provide an HTTPS endpoint URL. You can subscribe to individual event types: `note.created`, `note.updated`, `note.deleted`, and `member.added`.

## Verifying webhook signatures

Every webhook request includes an `X-Nimbus-Signature` header, an HMAC-SHA256 signature of the raw request body using your webhook signing secret (shown once when you create the webhook). Always verify this signature before trusting a webhook payload, to confirm it actually came from Nimbus Notes and not a forged request.

## Retries

If your endpoint doesn't return a 2xx status, the webhook is retried up to 5 times with exponential backoff over roughly 24 hours, after which it is marked as failed and appears in the webhook delivery log under Settings > Developer > Webhooks > Delivery Log.

## Payload size

Webhook payloads are capped at 256 KB. For notes larger than that, the payload includes only the note ID and metadata, and your server should fetch the full note body via the REST API.
