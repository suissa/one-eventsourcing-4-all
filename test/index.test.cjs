const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { EventSourcingFactory, uuidv7 } = require('../dist/index.js');

test('records sync returns, failures, correlation and causality', () => {
  class Actor {
    add(value) { return value + 1; }
    fail() { throw new Error('expected failure'); }
  }

  const transport = new EventEmitter();
  const events = [];
  transport.on('domain.event', (event) => events.push(event));
  const actor = EventSourcingFactory.wrap(new Actor(), {
    canonicalName: 'Test.Actor', context: 'Test', eventEmitter: transport,
  });

  assert.equal(actor.add(1), 2);
  assert.throws(() => actor.fail(), /expected failure/);
  assert.equal(events.length, 2);
  assert.equal(events[0].canonical_name, 'Test.Actor.method_return');
  assert.equal(events[1].type, 'method_error');
  assert.equal(events[0].correlation_id, events[1].correlation_id);
  assert.equal(events[1].causality_id, events[0].id);
  assert.match(events[0].event_id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(events[0].id, events[0].event_id);
  assert.equal(actor.$events().length, 2);
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
