# Integrations

Nimbus Notes has first-party integrations with Slack, Google Calendar, and Zapier.

## Slack

Connect a workspace to Slack from Settings > Integrations > Slack. Once connected, you can share any note to a channel with the `/nimbus share` slash command, and get a daily digest of notes created in the last 24 hours posted to a channel of your choice.

## Google Calendar

Notes tagged with a due date automatically create a matching Google Calendar event once Google Calendar is connected under Settings > Integrations > Google Calendar. Deleting the note also removes the calendar event.

## Zapier

Nimbus Notes publishes a Zapier app with triggers for "Note Created" and "Note Tagged", and actions for "Create Note" and "Append to Note". This lets you connect Nimbus Notes to over 5,000 other apps without writing code.

## Custom integrations

For anything not covered by the above, use the REST API directly (see the API Keys and Authentication doc) or the incoming webhooks described in the Webhooks doc.
