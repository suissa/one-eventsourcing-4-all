<p align="center">
  <img width="1448" height="1086" alt="image" src="https://github.com/user-attachments/assets/1c254960-3f2f-4074-81f0-06f31d8172e6" />
</p>

### Event Sourcing transparente via Proxy — zero config, zero dependências.

<br/>

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Deps-Zero-00d4aa?logo=checkmarx&logoColor=white)](.)
[![License](https://img.shields.io/badge/License-MIT-purple)](LICENSE)
[![Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e1?logo=bun&logoColor=black)](https://bun.sh)
[![Event Sourcing](https://img.shields.io/badge/Pattern-Event_Sourcing-ff6b6b)](.)
[![Proxy](https://img.shields.io/badge/Engine-ES6_Proxy-ffd93d)](.)

<br/>

**Transforme qualquer objeto ou classe em uma entidade event-sourced.**  
**Sem alterar uma linha do seu código original.**

---

<br/>

## 🧬 O que é?

**`one-eventsourcing-4-all`** é uma micro-lib TypeScript de alto desempenho que aplica a fronteira de Event Sourcing e Observabilidade de forma **transparente** usando `ES6 Proxy` e `EventEmitter`.

A arquitetura separa explicitamente **Telemetria de Execução** de **Fatos Semânticos de Domínio**:

1. 🔍 **Telemetria Transparente (`ObservabilityEvent`)**: Captura automaticamente retornos de métodos (`method_return`), falhas (`method_error`) e pulsos de vida (`health_check`) com tempos, argumentos e correlation ID, sem poluir o histórico de domínio.
2. 🏛️ **Fatos de Negócio Imutáveis (`DomainEvent`)**: Registro explícito de eventos de negócio versionados com IDs RFC 9562 **UUIDv7** ordenados no tempo, cadeias de causalidade (`causality_id`), nomes canônicos e persistência assíncrona serializada (`eventSink`).

> **Zero config. Zero dependências externas. Compatibilidade total com campos privados ECMAScript (`#private`).**

<br/>

---

## ⚡ Por que usar?

<table>
<tr>
<td width="50%">

### 🚫 Sem a lib

```typescript
class UserService {
  addUser(name: string) {
    logger.info("addUser called", { name });
    telemetry.record("addUser", { name });
    eventBus.emit("user:added", { name });

    this.users.push(name);
    return { id: Math.random(), name };
  }
}
```

❌ Código poluído com logs e telemetria<br/>
❌ Acoplamento entre lógica e observabilidade<br/>
❌ Violação do SRP (Single Responsibility)<br/>
❌ Difícil de manter e testar<br/>

</td>
<td width="50%">

### ✅ Com a lib

```typescript
class UserService {
  addUser(name: string) {
    this.users.push(name);
    return { id: Math.random(), name };
  }
}

const service = EventSourcingFactory.wrap(
  new UserService(),
  {
    canonicalName: "User.Service",
    eventSink: databaseSink,
  }
);

// Telemetria automática + emissão semântica limpa
service.$emitSemanticEvent("UserCreated", { name: "Alice" });
```

✅ Código limpo e focado na regra de negócio<br/>
✅ Telemetria automática via Proxy<br/>
✅ Event Store limpo sem ruído de métodos internos<br/>
✅ Tipagem original 100% preservada<br/>

</td>
</tr>
</table>

<br/>

---

## 🏗️ Arquitetura

```text
┌──────────┐    ┌────────────────────────────────────────────────────────┐
│          │    │                 EventSourcingFactory                   │
│  Caller  │───▶│                                                        │
│          │    │  Proxy ──▶ Intercept Method ──▶ ObservabilityEvent     │
│          │◀───│     │                           (telemetria)           │
└──────────┘    │     ▼                                                  │
                │  $emitSemanticEvent() ───────▶ DomainEvent (UUIDv7)    │
                │                                 ├─▶ EventSink (DB)     │
                │                                 ├─▶ EventEmitter       │
                │                                 └─▶ $on() local        │
                │  🫀 Health Check (background)                          │
                └────────────────────────────────────────────────────────┘

Retorna: EventSourced<T> = T & { $on, $off, $events, $emitSemanticEvent, $dispose }
Tipagem original 100% preservada ✨
```

<br/>

---

## 📦 Instalação

```bash
# npm
npm install @purecore/one-eventsourcing-4-all

# bun
bun add @purecore/one-eventsourcing-4-all

# pnpm
pnpm add @purecore/one-eventsourcing-4-all
```

<br/>

---

## 🚀 Quick Start

### 1️⃣ Importe a Factory

```typescript
import { EventSourcingFactory, generateId } from "@purecore/one-eventsourcing-4-all";
```

### 2️⃣ Crie sua classe normalmente

```typescript
class OrderService {
  #orders: Map<string, number> = new Map();

  createOrder(productId: string, quantity: number) {
    const orderId = generateId();
    this.#orders.set(orderId, quantity);
    return { orderId, productId, quantity, status: "created" };
  }

  cancelOrder(orderId: string) {
    this.#orders.delete(orderId);
    return { orderId, status: "cancelled" };
  }
}
```

### 3️⃣ Envolva com a Factory

```typescript
const orderService = EventSourcingFactory.wrap(new OrderService(), {
  canonicalName: "Commerce.OrderService",
  context: "Commerce",
  onObservation: (obs) => {
    // Telemetria automática de chamadas (method_return, method_error)
    console.log(`[TELEMETRY] ${obs.actor}.${obs.method} (${obs.type})`);
  },
  onEvent: (event) => {
    // Fatos de domínio emitidos para Event Store
    console.log(`[DOMAIN EVENT] ${event.canonical_name} (${event.id})`);
  },
});
```

### 4️⃣ Use normalmente e emita fatos de negócio quando apropriado

```typescript
// Execução normal (emite telemetria automática sem poluir o Event Store)
const order = orderService.createOrder("SKU-001", 3);

// Emissão de fato semântico de domínio (UUIDv7, persistência assíncrona)
orderService.$emitSemanticEvent("OrderCreated", {
  orderId: order.orderId,
  quantity: order.quantity,
});
```

<br/>

---

## 🔬 API Reference

### `EventSourcingFactory.wrap<T>(target, options?)`

Envolve um objeto ou instância de classe com capacidades de Event Sourcing e telemetria transparente.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `target` | `T extends object` | Objeto ou instância de classe |
| `options` | `EventSourcingOptions` | Configurações opcionais de canal, sink e telemetria |

**Retorna:** `EventSourced<T>` — a instância original com métodos `$on()`, `$off()`, `$events()`, `$emitSemanticEvent()` e `$dispose()`.

---

### `EventSourcingOptions`

| Propriedade | Tipo | Padrão | Descrição |
|---|---|---|---|
| `canonicalName` | `string` | Nome da classe | Nome canônico do ator no sistema |
| `version` | `string` | `'1.0.0'` | Versão do schema/ator |
| `producer` | `string` | Nome da classe | Identificador do produtor do evento |
| `context` | `string` | Nome da classe | Contexto semântico de domínio |
| `correlationId` | `string` | `generateId()` (UUIDv7) | ID de correlação raiz para a sessão |
| `eventSink` | `EventSink` | `undefined` | Mecanismo de persistência assíncrona serializada (`append(event)`) |
| `eventEmitter` | `EventEmitter` | `undefined` | EventEmitter global para eventos de domínio |
| `onEvent` | `(e: DomainEvent) => void` | `undefined` | Callback para cada evento de domínio emitido |
| `observabilityEmitter` | `EventEmitterLike` | `undefined` | Barramento para telemetria (`observability.event`) |
| `onObservation` | `(o: ObservabilityEvent) => void` | `undefined` | Callback para telemetria de chamadas de método |
| `maxHistory` | `number` | `5000` | Quantidade de eventos recentes mantidos em memória (`$events()`) |
| `enableHealthCheck` | `boolean` | `false` | Ativa heartbeat de monitoramento periódico |
| `healthIntervalMs` | `number` | `30000` | Intervalo do health check em milissegundos |

---

### `DomainEvent<TPayload>`

Estrutura imutável de um fato de negócio gravado no Event Store:

```typescript
interface DomainEvent<TPayload = unknown> {
  event_id: string;        // UUIDv7 (RFC 9562) ordenável no tempo
  id: string;              // Alias de compatibilidade para event_id
  type: string;            // Ex: "OrderCreated", "PaymentProcessed"
  canonical_name: string;  // Ex: "Commerce.OrderService.OrderCreated"
  version: string;         // Ex: "1.0.0"
  producer: string;        // Identificador do produtor
  context: string;         // Contexto do domínio
  timestamp: string;       // ISO 8601 UTC
  correlation_id: string;  // UUIDv7 correlacionando a sessão/transação
  causality_id?: string;   // ID do evento imediatamente anterior na cadeia
  payload: TPayload;       // Dados de negócio imutáveis
  metadata: {
    kind: 'semantic';      // Demarca fato de negócio
    method?: string;
    targetClass: string;
    success?: boolean;
    error?: { name: string; message: string };
  };
}
```

---

### `ObservabilityEvent<TPayload>`

Estrutura de telemetria emitida durante a execução dos métodos:

```typescript
interface ObservabilityEvent<TPayload = unknown> {
  type: 'method_return' | 'method_error' | 'health_check';
  actor: string;
  method?: string;
  timestamp: string;
  correlation_id: string;
  payload: TPayload;
  success?: boolean;
  error?: { name: string; message: string };
}
```

---

### `EventSourced<T>`

Extensão aplicada sobre o tipo original `T`:

| Método | Assinatura | Descrição |
|---|---|---|
| `$emitSemanticEvent` | `(type: string, payload: unknown, metadata?: object) => DomainEvent` | Emite e persiste um fato semântico de domínio |
| `$on` | `(handler: (e: DomainEvent) => void) => () => void` | Registra listener local para eventos de domínio |
| `$off` | `(handler: (e: DomainEvent) => void) => void` | Remove um listener |
| `$events` | `() => readonly DomainEvent[]` | Retorna o snapshot do histórico em memória |
| `$dispose` | `() => void` | Cancela timers e libera handlers |

---

### Utilitários Exportados

#### `generateId(now?: number): string`
Gera um identificador **UUIDv7** compatível com RFC 9562, ordenável lexicograficamente no tempo com precisão de milissegundos.

#### `uuidv7(now?: number): string`
Alias `@deprecated` de compatibilidade direta para `generateId()`.

<br/>

---

## 🎯 Casos de Uso

### 📊 Persistência Assíncrona Serializada (`EventSink`)

Garante que chamadas simultâneas de métodos não criem promessas concorrentes desgovernadas no banco:

```typescript
const databaseSink: EventSink = {
  async append(event) {
    await db.collection("events").insertOne(event);
  },
};

const service = EventSourcingFactory.wrap(new PaymentProcessor(), {
  canonicalName: "Financial.Payments",
  eventSink: databaseSink,
});

service.$emitSemanticEvent("PaymentCaptured", { amount: 1500, currency: "BRL" });
```

### 🔄 CQRS & Projeções Reativas

```typescript
const service = EventSourcingFactory.wrap(new WriteModel());

service.$on((event) => {
  if (event.type === "OrderCreated") {
    orderSummaryProjection.apply(event);
  }
});
```

### 🔒 Suporte a ECMAScript Private Fields (`#private`)

Ao contrário de proxies convencionais, a lib utiliza o alvo original como `receiver` nos métodos internos, garantindo que classes com campos privados nativos não lancem `TypeError: Cannot read private member`:

```typescript
class SecureWallet {
  #balance = 1000;

  withdraw(val: number) {
    if (this.#balance < val) throw new Error("Saldo insuficiente");
    this.#balance -= val;
    return this.#balance;
  }
}

// Funciona 100% sem quebrar o brand check nativo
const wallet = EventSourcingFactory.wrap(new SecureWallet());
wallet.withdraw(100);
```

<br/>

---

## 🧩 Princípios de Design

| Princípio | Aplicação |
|---|---|
| **Separation of Concerns** | Telemetria (`ObservabilityEvent`) e fatos de negócio (`DomainEvent`) são fluxos desacoplados |
| **Open/Closed** | As classes originais não são alteradas nem requerem herança |
| **Time-Ordered Identity** | Todos os IDs (`event_id`, `correlation_id`) são UUIDv7 (RFC 9562) |
| **Backpressure Safe** | O `EventSink` serializa a persistência sem sobrecarregar a conexão |
| **Type Safety** | Generics preservam 100% dos tipos e assinaturas dos métodos |

<br/>

---

## 📜 Licença

MIT © [PureCore](https://github.com/purecore)
