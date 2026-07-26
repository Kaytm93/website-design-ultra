# Reliability

The queue retries a failed webhook four times over 30 minutes, then moves the
payload to the dead-letter table. We measured 99.4% delivery on 2026-06-01
across 1.2M events; the remaining failures were customer endpoints returning 5xx
for longer than the retry window.

Our storage layer is robust against a single-zone outage: writes are replicated
to two zones before the API returns 201. Read-after-write is guaranteed in the
same zone only.

If you need cross-region replication, open an issue. It is not implemented.
