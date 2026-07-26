# Retry policy

## Attempts

The queue makes four attempts over 30 minutes before it gives up on a webhook
endpoint and stops calling it for that event.

## Backoff

Backoff is exponential with a base of two seconds, so the gaps are two, four,
eight, and sixteen seconds plus jitter.

## Dead letter

After the fourth failure the payload moves to the `dead_letter` table, where it
stays for 30 days and can be replayed by hand.

## Fields

- **id** — the event identifier
- **attempt** — one-based counter
- **status** — last HTTP status
- **payload** — the original body
- **failed_at** — timestamp of the last attempt
- **endpoint** — the customer URL
