import { randomBytes, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

/** A versioned fact produced by an event-sourced actor. */
export interface DomainEvent<TPayload = unknown> {
  /** UUIDv7 event identity. `id` is retained as the compatibility alias. */
  event_id: string;
  id: string;
  type: string;
  canonical_name: string;
  version: string;
  producer: string;
  context: string;
  timestamp: string;
  correlation_id: string;
  causality_id?: string;
  payload: TPayload;
  metadata: {
    method?: string;
    targetClass: string;
    success?: boolean;
    error?: { name: string; message: string };
  };
}

export interface EventSink {
  append(event: DomainEvent): void | Promise<void>;
}

type EventMetadataInput = Omit<DomainEvent['metadata'], 'targetClass'>;

export interface EventSourcingOptions {
  canonicalName?: string;
  version?: string;
  producer?: string;
  context?: string;
  correlationId?: string;
  eventEmitter?: EventEmitter;
  eventSink?: EventSink;
  onEvent?: (event: DomainEvent) => void | Promise<void>;
  /** Disabled by default so importing a module never leaves an open timer. */
  enableHealthCheck?: boolean;
  healthIntervalMs?: number;
  /** Maximum number of recent events retained by the in-memory facade. */
  maxHistory?: number;
}

/** Generates a RFC 9562 UUIDv7 with millisecond time ordering. */
export function uuidv7(now = Date.now()): string {
  const bytes = randomBytes(16);
  const timestamp = BigInt(now);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp >> BigInt((5 - index) * 8)) & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type EventSourced<T> = T & {
  $on(handler: (event: DomainEvent) => void): () => void;
  $off(handler: (event: DomainEvent) => void): void;
  $events(): readonly DomainEvent[];
  $dispose(): void;
};

/** Wraps an actor and records method returns and failures as immutable facts. */
export class EventSourcingFactory {
  static wrap<T extends object>(target: T, options: EventSourcingOptions = {}): EventSourced<T> {
    const handlers = new Set<(event: DomainEvent) => void>();
    const history: DomainEvent[] = [];
    const maxHistory = Math.max(0, options.maxHistory ?? 5_000);
    let sinkQueue = Promise.resolve();
    const emitter = options.eventEmitter;
    const className = target.constructor?.name || 'AnonymousActor';
    const correlationId = options.correlationId ?? randomUUID();
    const canonicalName = options.canonicalName ?? className;
    const version = options.version ?? '1.0.0';
    const producer = options.producer ?? className;
    const context = options.context ?? className;

    const emit = (type: string, payload: unknown, method?: string, metadata: EventMetadataInput = {}) => {
      const eventId = uuidv7();
      const event: DomainEvent = Object.freeze({
        event_id: eventId,
        id: eventId,
        type,
        canonical_name: `${canonicalName}.${type}`,
        version,
        producer,
        context,
        timestamp: new Date().toISOString(),
        correlation_id: correlationId,
        causality_id: history[history.length - 1]?.id,
        payload,
        metadata: Object.freeze({ ...metadata, targetClass: className, method }),
      });
      if (maxHistory > 0) {
        history.push(event);
        if (history.length > maxHistory) history.splice(0, history.length - maxHistory);
      }
      emitter?.emit(event.canonical_name, event);
      emitter?.emit('domain.event', event);
      // Serialize persistence callbacks. A busy API must not create one
      // unbounded database promise per method invocation.
      if (options.eventSink) {
        sinkQueue = sinkQueue
          .then(() => options.eventSink!.append(event))
          .catch(() => undefined);
      }
      void options.onEvent?.(event);
      for (const handler of handlers) handler(event);
      return event;
    };

    let healthTimer: NodeJS.Timeout | undefined;
    if (options.enableHealthCheck) {
      healthTimer = setInterval(() => {
        emit('health_check', { status: 'alive', memory: process.memoryUsage() });
      }, options.healthIntervalMs ?? 30_000);
    }

    const proxy = new Proxy(target, {
      get(currentTarget, prop, receiver) {
        if (prop === '$on') return (handler: (event: DomainEvent) => void) => { handlers.add(handler); return () => handlers.delete(handler); };
        if (prop === '$off') return (handler: (event: DomainEvent) => void) => { handlers.delete(handler); };
        if (prop === '$events') return () => [...history];
        if (prop === '$dispose') return () => { if (healthTimer) clearInterval(healthTimer); handlers.clear(); };

        // Use the original target as receiver. This is required for classes
        // using ECMAScript private fields (#field), whose brand check rejects
        // a Proxy receiver even when the method itself is invoked correctly.
        const value = Reflect.get(currentTarget, prop, currentTarget);
        if (typeof value !== 'function') return value;

        return (...args: unknown[]) => {
          try {
            const result = value.apply(currentTarget, args);
            if (result && typeof (result as Promise<unknown>).then === 'function') {
              return Promise.resolve(result).then(
                (resolved) => { emit('method_return', { args, return: resolved }, String(prop), { success: true }); return resolved; },
                (error: unknown) => { const serialized = serializeError(error); emit('method_error', serialized, String(prop), { success: false, error: serialized }); throw error; },
              );
            }
            emit('method_return', { args, return: result }, String(prop), { success: true });
            return result;
          } catch (error) {
            const serialized = serializeError(error);
            emit('method_error', serialized, String(prop), { success: false, error: serialized });
            throw error;
          }
        };
      },
    });

    return proxy as EventSourced<T>;
  }
}

function serializeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'UnknownError', message: String(error) };
}
