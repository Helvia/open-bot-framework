# Architecture: open-bot-framework

## Component Diagram

```mermaid
flowchart LR
    webchatClient(["Webchat Client<br/>(browser widget)"])
    botBackend(["Bot Backend<br/>(hbf-bot or other HTTP endpoint)"])

    subgraph HTTP["HTTP API :1986"]
        authCtrl["AuthorizationController<br/>/oauth2/v2.0/token"]
        dlCtrl["DirectlineController<br/>/v3/directline/..."]
        dlAltCtrl["DirectlineAltController<br/>/v3/conversations/.../activities"]
        botCtrl["OpenBotController<br/>/bots"]
        secretCtrl["OpenBotSecretController<br/>/bots/:id/secrets"]
        webchatCtrl["WebChatController<br/>/bots/:id/webchat"]
    end

    subgraph WS["WebSocket :1992"]
        dlGateway["DirectLineGateway<br/>ws server, per-conv socket map"]
    end

    subgraph Services
        authSvc["AuthorizationService<br/>JWT sign/verify"]
        tokenSvc["DirectlineTokenService<br/>generate/refresh/verify DL token"]
        convSvc["DirectlineConversationService<br/>conversation lifecycle, activity routing"]
        botSvc["OpenBotService<br/>bot CRUD + cached lookup"]
        secretSvc["OpenBotSecretService<br/>bcrypt hash + validate"]
        webchatSvc["WebChatService<br/>channel CRUD"]
        storageSvc["StorageService<br/>S3-compatible upload"]
        atomicSvc["AtomicOperationsService<br/>activity watermark counter"]
    end

    subgraph Data
        pg[("PostgreSQL<br/>obf DB")]
        redis[("Redis")]
        s3[("S3-compatible<br/>storage")]
    end

    webchatClient -->|"REST + Bearer secret/token"| dlCtrl
    webchatClient -->|"WebSocket t=token"| dlGateway
    botBackend -->|"POST /v3/conversations/.../activities"| dlAltCtrl
    botBackend -->|"POST /oauth2/v2.0/token"| authCtrl

    dlCtrl --> tokenSvc
    dlCtrl --> convSvc
    dlAltCtrl --> convSvc
    authCtrl --> authSvc

    convSvc --> tokenSvc
    convSvc --> authSvc
    convSvc --> botSvc
    convSvc --> dlGateway
    convSvc --> storageSvc
    convSvc --> atomicSvc
    convSvc -->|"HTTP POST activity"| botBackend

    botCtrl --> botSvc
    secretCtrl --> secretSvc
    webchatCtrl --> webchatSvc

    botSvc --> pg
    secretSvc --> pg
    webchatSvc --> pg
    tokenSvc --> pg

    atomicSvc -->|"redis impl"| redis
    storageSvc --> s3
```

## Flow: User Sends Message

```mermaid
flowchart TD
    A["Client POSTs activity<br/>POST /v3/directline/conversations/:id/activities"] --> B["Verify DirectLine JWT"]
    B --> C["Enrich activity<br/>(id, timestamp, serviceUrl, conversation)"]
    C --> D["HTTP POST to bot endpoint"]
    D --> E["Send activity over WebSocket<br/>to conversation stream"]
    E --> F["Return { id: activityId }"]
```

## Flow: Bot Replies

```mermaid
flowchart TD
    A["Bot POSTs reply<br/>POST /v3/conversations/:id/activities/:actId"] --> B["Verify access token<br/>(OAuth2 client credentials JWT)"]
    B --> C["Set replyToId, enrich activity"]
    C --> D["Increment watermark counter<br/>(Redis or memory)"]
    D --> E["Send Transcript over WebSocket<br/>with watermark to client"]
    E --> F["Return { id: activityId }"]
```

## Notes

- Two ports: HTTP (1986) for REST, separate WebSocket server (1992) for streaming.
- `synchronize: true` in TypeORM config — schema auto-syncs on startup (dev-safe, disable in prod).
- Atomicity backend selected at startup from `ATOMIC_OPERATIONS_IMPLEMENTATION` env: `redis` (requires Redis) or `memory` (single-instance only).
- Bot secrets are bcrypt-hashed. `plainReducted` stores a redacted plain version for display.
- Activity IDs follow DirectLine convention: `<conversationId>|<7-digit-zero-padded-counter>`.
- `typing` activities get random IDs and do not increment the watermark counter.
