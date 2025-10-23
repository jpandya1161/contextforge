# API Rate Limits

The Nimbus Notes API enforces rate limits per API key to keep the service fast for everyone.

Free and Team plan API keys are limited to 60 requests per minute and 20,000 requests per day. Business plan API keys are limited to 300 requests per minute and 200,000 requests per day.

## Rate limit headers

Every API response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers so clients can back off proactively instead of waiting for a 429.

## Handling 429 errors

When you exceed your limit, the API returns HTTP 429 with a `Retry-After` header indicating how many seconds to wait. We recommend exponential backoff starting at 1 second, doubling up to a maximum of 60 seconds, with jitter.

## Requesting a higher limit

Business plan customers with sustained high-volume needs can request a custom rate limit increase by emailing api-support@nimbusnotes.example with their expected requests per minute and use case.
