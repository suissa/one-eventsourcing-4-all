# 🔮 one-eventsourcing-4-all

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
<br/>
**Sem alterar uma linha do seu código original.**

---

<br/>

## 🧬 O que é?

**`one-eventsourcing-4-all`** é uma micro-lib TypeScript que aplica o padrão [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) de forma **transparente** usando `ES6 Proxy`.

Você envolve qualquer objeto — seja um POJO, uma instância de classe, um serviço, um repositório — e automaticamente **toda chamada de método** passa a emitir eventos tipados com:

- 🕐 **Timestamp** exato da execução
- 📦 **Payload** com argumentos e retorno
- 🏷️ **Metadata** com nome do método e classe de origem
- 💓 **Health Check** automático em background

> **Zero config. Zero dependências. Zero fricção.**

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
    analytics.track("user_added", { name });
    eventBus.emit("user:added", { name });

    this.users.push(name);
    return { id: Math.random(), name };
  }
}
```

❌ Código poluído com side-effects<br/>
❌ Acoplamento entre lógica e observabilidade<br/>
❌ Violação do SRP<br/>
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
  new UserService()
);

service.$on(event => {
  // Todos os eventos, automaticamente!
});
```

✅ Código limpo e focado<br/>
✅ Zero acoplamento<br/>
✅ Eventos automáticos via Proxy<br/>
✅ Tipagem 100% preservada<br/>

</td>
</tr>
</table>

<br/>

---

## 🏗️ Arquitetura

```
┌──────────┐    ┌────────────────────────────────────┐
│          │    │      EventSourcingFactory           │
│  Caller  │───▶│                                    │
│          │    │  Proxy ──▶ Intercept ──▶ Emit Event │
│          │◀───│                                    │
└──────────┘    │  ┌────────────┐  ┌──────────────┐  │
                │  │  onEvent   │  │  $on() local │  │
                │  │  (global)  │  │  (instância) │  │
                │  └────────────┘  └──────────────┘  │
                │                                    │
                │  🫀 Health Check (background)      │
                └────────────────────────────────────┘

Retorna: EventSourced<T> = T & { $on, $dispose }
Tipagem original 100% preservada ✨
```

<br/>

---

## 📦 Instalação

```bash
bun add @purecore/one-eventsourcing-4-all
```

<br/>

---

## 🚀 Quick Start

### 1️⃣ Importe a Factory

```typescript
import { EventSourcingFactory } from "@purecore/one-eventsourcing-4-all";
```

### 2️⃣ Crie sua classe normalmente

```typescript
class OrderService {
  private orders: Map<string, number> = new Map();

  createOrder(productId: string, quantity: number) {
    const orderId = crypto.randomUUID();
    this.orders.set(orderId, quantity);
    return { orderId, productId, quantity, status: "created" };
  }

  cancelOrder(orderId: string) {
    this.orders.delete(orderId);
    return { orderId, status: "cancelled" };
  }
}
```

### 3️⃣ Envolva com a Factory

```typescript
const orderService = EventSourcingFactory.wrap(new OrderService(), {
  enableHealthCheck: true,
  healthIntervalMs: 10_000,
  onEvent: (event) => {
    // log global de todos os eventos
    console.log(`[${event.metadata.targetClass}] ${event.type}`);
  },
});
```

### 4️⃣ Use normalmente — os eventos são automáticos!

```typescript
const order = orderService.createOrder("SKU-001", 3);
// → [OrderService] method_return

orderService.cancelOrder(order.orderId);
// → [OrderService] method_return
```

<br/>

---

## 🔬 API Reference

### `EventSourcingFactory.wrap<T>(target, options?)`

Transforma um objeto em uma entidade event-sourced.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `target` | `T extends object` | Objeto ou instância de classe |
| `options` | `EventSourcingOptions` | Configurações opcionais |

**Retorna:** `EventSourced<T>` — o mesmo tipo com `$on()` e `$dispose()`.

---

### `EventSourcingOptions`

| Propriedade | Tipo | Default | Descrição |
|---|---|---|---|
| `healthIntervalMs` | `number` | `30000` | Intervalo do health check em ms |
| `enableHealthCheck` | `boolean` | `true` | Ativa/desativa o health check |
| `onEvent` | `(e: DomainEvent) => void` | `undefined` | Callback global |

---

### `DomainEvent`

```typescript
interface DomainEvent {
  type: string;          // "method_return" | "health_check"
  timestamp: number;     // Date.now()
  payload: any;          // { args, return } ou { status, memory }
  metadata: {
    method?: string;     // Nome do método chamado
    targetClass: string; // Nome da classe original
  };
}
```

---

### `EventSourced<T>`

| Método | Assinatura | Descrição |
|---|---|---|
| `$on` | `(handler: (e: DomainEvent) => void) => void` | Registra listener |
| `$dispose` | `() => void` | Remove listeners e para o health check |

<br/>

---

## 🎯 Casos de Uso

### 📊 Audit Trail

```typescript
const auditLog: DomainEvent[] = [];

const paymentService = EventSourcingFactory.wrap(new PaymentService(), {
  onEvent: (event) => {
    auditLog.push(event);
    // Persista no banco, envie para Kafka, etc.
  },
});

paymentService.processPayment("user-42", 199.90);
```

### 🔄 CQRS + Event Sourcing

```typescript
const commandService = EventSourcingFactory.wrap(new WriteModel());

commandService.$on((event) => {
  if (event.type === "method_return") {
    readModel.project(event); // Projection
  }
});
```

### 🧪 Debug & Profiling

```typescript
const debugService = EventSourcingFactory.wrap(new CriticalService(), {
  onEvent: (event) => {
    const elapsed = Date.now() - event.timestamp;
    if (elapsed > 100) {
      console.warn(`⚠️ Slow: ${event.metadata.method} (${elapsed}ms)`);
    }
  },
});
```

### 🌐 Async/Await nativo

```typescript
class ApiService {
  async fetchUser(id: string) {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  }
}

const api = EventSourcingFactory.wrap(new ApiService());

api.$on((event) => {
  // Evento emitido APÓS o resolve da Promise
  console.log("Resolved:", event.payload.return);
});

await api.fetchUser("42");
```

<br/>

---

## 🧩 Como Funciona

A mágica acontece em 3 camadas:

1. **`Proxy` com trap `get`** → Intercepta todo acesso a propriedades
2. **Detecção de função** → Se o valor é uma função, cria um wrapper
3. **Emissão pós-execução** → Após execução (ou resolve da Promise), emite o `DomainEvent`

### Princípios de Design

| Princípio | Aplicação |
|---|---|
| **Open/Closed** | Classes originais não são modificadas |
| **Single Responsibility** | Lógica de negócio não sabe dos eventos |
| **Dependency Inversion** | O consumidor decide o que fazer |
| **Transparency** | Proxy preserva a interface original |
| **Type Safety** | Generics garantem tipagem completa |

<br/>

---

## 🧠 Filosofia

> *"Você não deveria precisar modificar seu código para observá-lo."*

O mesmo mecanismo usado pelo **Vue.js** para reatividade, pelo **MobX** para observables, e pelo **Immer** para imutabilidade — aplicado ao **Event Sourcing**.

- 🪶 **Não pesa** — menos de 5KB, zero deps
- 🧊 **Não invade** — seu código continua puro
- 🔌 **Não acopla** — conecte qualquer consumer
- ⚡ **Não bloqueia** — async-first por design

<br/>

---

## 🗂️ Estrutura do Projeto

```
one-eventsourcing-4-all/
├── src/
│   └── index.ts       # A lib inteira — simples e poderosa
├── .gitignore
├── CHANGELOG.md
└── README.md          # Você está aqui 👋
```

📋 Veja o [CHANGELOG.md](CHANGELOG.md) para o histórico de mudanças.

<br/>

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie sua branch: `git checkout -b feat/minha-feature`
3. Faça suas alterações
4. Envie um PR com descrição clara

<br/>

---

## 📜 Licença

MIT © [PureCore](https://github.com/purecore)

<br/>

---

<div align="center">

*"Observe everything. Change nothing."*

**Feito com 🧠 por [@purecore](https://github.com/purecore)**

**[⬆ Voltar ao topo](#-one-eventsourcing-4-all)**

</div>
]]>
