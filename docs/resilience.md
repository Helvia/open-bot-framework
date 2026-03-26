# Resilience: open-bot-framework

> Error handling and retry patterns for this service.
> Platform-wide patterns: [`docs/architecture/resilience.md`](../../docs/architecture/resilience.md)

## HTTP Retry

- **Library:** `@nestjs/axios` `HttpService` (raw axios, no shared retry wrapper — does NOT use `hbf-core-api`)
- **Attempts:** 1 (no retry)
- **Backoff:** None
- **On failure:** Caught in `userReplyToConversation()`, rethrows as `BadRequestException` with error message surfaced to the client. Bot endpoint failures are immediately visible to the user.

## Queue Retry

Not applicable. open-bot-framework does not use Bull or any message queue.

## WebSocket Delivery Retry

`DirectLineGateway.sendToConversation()` retries delivery to a connected WebSocket client up to 3 times when the conversation socket is not yet registered (e.g., client connecting slowly).

| Attempt | Delay before attempt |
|---------|---------------------|
| 1 | immediate |
| 2 | 1000ms |
| 3 | 2000ms |

Backoff is linear (not exponential): `1000 * attempt`. After 3 failed attempts the transcript is dropped and a warning is logged. No persistence or replay mechanism exists.

## Timeouts

| Call | Timeout | Configured in |
|------|---------|--------------|
| Bot endpoint POST (activity forwarding) | 5000ms | `directline-conversation.service.ts` line 162 |
| Redis connect | 2000ms | `atomic-operations.provider.ts` (`connectTimeout`) |
| S3 upload | None | AWS SDK default (no explicit timeout) |

## Circuit Breakers

None detected.

## Redis Fallback

`atomic-operations.provider.ts` selects the atomic counter backend at startup:

1. If `ATOMIC_OPERATIONS_IMPLEMENTATION=memory` or `REDIS_URI` is not set, uses in-memory backend immediately.
2. Attempts `redis.connect()` with `connectTimeout: 2000ms`.
3. On connection failure, logs a warning and falls back to `MemoryAtomicOperationsManager`.

The in-memory fallback is explicitly labelled as development/emergency-only. Activity watermark counters lose durability and cross-instance consistency when it is active (single-instance only, resets on restart).

## Exception Handling

A global `AllExceptionsFilter` (`src/filters/exception.filter.ts`) catches all unhandled exceptions:

- `HttpException` subclasses: status code preserved, message surfaced to caller as structured JSON `{ statusCode, timestamp, message, path, description }`.
- Non-HTTP exceptions: status 500, full `String(exception)` as message, logged at `error` level.
- `HttpException` (non-500): logged at `verbose` level only.

No exceptions are silently swallowed at the controller level. Business-logic errors in services throw NestJS HTTP exceptions which propagate through the filter.

## Fallback Strategy

| Failure scenario | Behaviour | User impact |
|-----------------|-----------|------------|
| Bot endpoint unreachable / error on activity POST | `BadRequestException` thrown, `AllExceptionsFilter` returns 400 with error details | User receives explicit error response |
| Redis unreachable at startup | Falls back to in-memory atomic counter manager | Watermark counters non-durable; consistency lost across restarts or multiple instances |
| S3 upload failure | `HttpException` 500 thrown, bubbles to global filter | User receives 500 with error message |
| WebSocket client not connected after 3 retries | Transcript dropped, warning logged | Bot reply silently lost; user does not receive the message |
| Invalid/expired DirectLine token | `UnauthorizedException` or `BadRequestException` | 401/400 returned to caller |

## Health Check

No dedicated health endpoint. `GET /` returns the string `"Hello World!"` (the NestJS scaffold default). There are no checks for database connectivity, Redis availability, or downstream reachability.

## Known Gaps

1. No HTTP retry on bot endpoint calls. A transient failure when forwarding a user activity to the bot results in an immediate error returned to the client.
2. No timeout on S3 uploads. A hung S3 connection can stall the activity creation request indefinitely.
3. No health endpoint. Orchestrators cannot detect unhealthy instances (DB disconnected, Redis down).
4. WebSocket transcript drops are silent to the end user. The client receives no notification that the bot reply was lost; it simply never arrives.
5. Redis fallback to in-memory is not safe for multi-instance deployments. Activity IDs will collide across instances.
6. No circuit breaker on the bot endpoint. A slow or failing downstream bot will accept and hold all user-activity HTTP requests for the full 5s timeout duration.
