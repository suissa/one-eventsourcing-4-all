/**
 * Interface que define a estrutura de um evento no sistema.
 */
export interface DomainEvent {
  type: string;
  timestamp: number;
  payload: any;
  metadata: {
    method?: string;
    targetClass: string;
  };
}

/**
 * Opções de configuração para o wrapper de Event Sourcing.
 */
export interface EventSourcingOptions {
  healthIntervalMs?: number; // Intervalo para o evento de health (default: 30000)
  enableHealthCheck?: boolean;
  onEvent?: (event: DomainEvent) => void; // Callback global para eventos
}

/**
 * Tipo utilitário que adiciona capacidades de evento a um tipo existente.
 */
export type EventSourced<T> = T & {
  $on: (handler: (event: DomainEvent) => void) => void;
  $dispose: () => void;
};

/**
 * Factory que encapsula objetos ou instâncias de classes com comportamentos de Event Sourcing.
 */
export class EventSourcingFactory {
  /**
   * Encapsula um objeto para rastrear mudanças e emitir eventos.
   * * @param target O objeto ou instância de classe a ser encapsulado.
   * @param options Configurações de comportamento.
   * @returns O objeto original extendido com métodos de evento ($on, $dispose).
   */
  static wrap<T extends object>(target: T, options: EventSourcingOptions = {}): EventSourced<T> {
    const handlers = new Set<(event: DomainEvent) => void>();
    const { healthIntervalMs = 30000, enableHealthCheck = true } = options;
    const className = target.constructor.name;

    // Função interna para disparar eventos
    const emit = (type: string, payload: any, method?: string) => {
      const event: DomainEvent = {
        type,
        timestamp: Date.now(),
        payload,
        metadata: {
          method,
          targetClass: className,
        },
      };

      if (options.onEvent) options.onEvent(event);
      handlers.forEach((h) => h(event));
    };

    // Configuração do Health Check
    let healthTimer: any = null;
    if (enableHealthCheck) {
      healthTimer = setInterval(() => {
        emit('health_check', { status: 'alive', memory: (process as any)?.memoryUsage?.() || 'N/A' });
      }, healthIntervalMs);
    }

    // Criação do Proxy para interceptar chamadas de métodos
    const proxy = new Proxy(target, {
      get(target: any, prop: string | symbol, receiver: any) {
        // Métodos especiais do wrapper
        if (prop === '$on') {
          return (handler: (event: DomainEvent) => void) => handlers.add(handler);
        }
        if (prop === '$dispose') {
          return () => {
            if (healthTimer) clearInterval(healthTimer);
            handlers.clear();
          };
        }

        const value = Reflect.get(target, prop, receiver);

        // Se for uma função, envolvemos ela para capturar o retorno
        if (typeof value === 'function') {
          return (...args: any[]) => {
            const result = value.apply(target, args);

            // Se for uma Promise, tratamos o resolve
            if (result instanceof Promise) {
              return result.then((res) => {
                emit('method_return', { args, return: res }, prop.toString());
                return res;
              });
            }

            // Emite o evento após a execução bem-sucedida (Event Sourcing pattern)
            emit('method_return', { args, return: result }, prop.toString());
            return result;
          };
        }

        return value;
      },
    });

    return proxy as EventSourced<T>;
  }
}

// --- EXEMPLO DE USO ---

class UserService {
  private users: string[] = [];

  addUser(name: string) {
    this.users.push(name);
    return { id: Math.random(), name };
  }

  getUsers() {
    return this.users;
  }
}

// 1. Instanciamos a classe original
const rawService = new UserService();

// 2. Encapsulamos com a Factory
const service = EventSourcingFactory.wrap(rawService, {
  healthIntervalMs: 5000, // Health a cada 5 segundos para o exemplo
  onEvent: (e) => console.log(`[LOG GLOBAL]: ${e.type} em ${e.metadata.method || 'system'}`)
});

// 3. Ouvindo eventos específicos desta instância
service.$on((event) => {
  if (event.type === 'method_return') {
    console.log(`Evento capturado! Método: ${event.metadata.method}`);
    console.log(`Payload:`, event.payload);
  }
});

// 4. Executando métodos normalmente (com tipagem preservada)
service.addUser("Alice");
service.addUser("Bob");

// O health check rodará em background até chamarmos service.$dispose()