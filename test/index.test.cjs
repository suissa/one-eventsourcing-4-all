const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { EventSourcingFactory, uuidv7 } = require('../dist/index.js');

test('sends execution telemetry without creating domain events', () => {
  class Actor {
    add(value) { return value + 1; }
    fail() { throw new Error('expected failure'); }
  }

  const transport = new EventEmitter();
  const events = [];
  const observations = [];
  transport.on('domain.event', (event) => events.push(event));
  transport.on('observability.event', (event) => observations.push(event));
  const actor = EventSourcingFactory.wrap(new Actor(), {
    canonicalName: 'Test.Actor', context: 'Test', eventEmitter: transport, observabilityEmitter: transport,
  });

  assert.equal(actor.add(1), 2);
  assert.throws(() => actor.fail(), /expected failure/);
  assert.equal(events.length, 0);
  assert.equal(observations.length, 2);
  assert.equal(observations[0].type, 'method_return');
  assert.equal(observations[1].type, 'method_error');
  assert.equal(observations[0].correlation_id, observations[1].correlation_id);
  assert.equal(actor.$events().length, 0);
});

test('persists only an explicitly emitted semantic event', async () => {
  const events = [];
  const actor = EventSourcingFactory.wrap({ read: () => 'value' }, {
    eventEmitter: new EventEmitter(),
    eventSink: { append: async (event) => events.push(event) },
  });

  actor.read();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 0);

  actor.$emitSemanticEvent('ProductCreated', { productId: 'p-1' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'ProductCreated');
  assert.equal(events[0].metadata.kind, 'semantic');
});

test('generates time-ordered UUIDv7 identifiers', () => {
  const first = uuidv7(1700000000000);
  const second = uuidv7(1700000000001);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(second, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(first < second);
});

test('preserves ECMAScript private fields through the Proxy', () => {
  class PrivateActor {
    #value = 3;
    get value() { return this.#value; }
    increment() { this.#value += 1; return this.#value; }
  }

  const actor = EventSourcingFactory.wrap(new PrivateActor());
  assert.equal(actor.value, 3);
  assert.equal(actor.increment(), 4);
  assert.equal(actor.value, 4);
});
