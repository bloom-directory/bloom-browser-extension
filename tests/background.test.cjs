const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
  const tabs = new Map();
  const connections = [];
  let tabId;
  const event = () => ({listeners: [], addListener(fn) { this.listeners.push(fn); }});
  const chrome = {
    runtime: {
      connectNative() {
        const connection = {onMessage: event(), onDisconnect: event(), replies: [], postMessage(value) { this.replies.push(value); }};
        connections.push(connection);
        return connection;
      },
      onStartup: event(), onInstalled: event(),
    },
    alarms: {create() {}, onAlarm: event()},
    storage: {session: {
      async get() { return {tabId}; },
      async set(value) { tabId = value.tabId; },
      async remove() { tabId = undefined; },
    }},
    tabs: {
      async get(id) { if (!tabs.has(id)) throw Error('closed'); return tabs.get(id); },
      async create(value) { const tab = {id: 41, ...value}; tabs.set(tab.id, tab); return tab; },
      async update(id, value) { Object.assign(tabs.get(id), value); return tabs.get(id); },
      async remove(id) { tabs.delete(id); },
    },
  };
  const context = vm.createContext({chrome, setTimeout, BLOOM_VERSION: 'fixture'});
  vm.runInContext(fs.readFileSync(require.resolve('../extension/background.js'), 'utf8'), context);
  return {run: command => context.run(command), connect: () => context.connect(), tabs, connections, chrome};
}

test('opens only reviewed airline domains', async () => {
  const f = fixture();
  for (const url of ['https://jetsmart.com/', 'https://booking.aerolineas.com.ar/']) {
    assert.equal((await f.run({action: 'open', url})).state, 'opened');
  }
  for (const url of ['https://buy.stripe.com/', 'https://serpapi.com/', 'https://jetsmart.com.evil.example/', 'http://jetsmart.com/']) {
    await assert.rejects(f.run({action: 'open', url}), /approved booking sites/);
  }
});

test('private cleanup closes only its recorded tab and forgets it', async () => {
  const f = fixture();
  f.tabs.set(99, {id: 99, url: 'https://example.com/'});
  await f.run({action: 'open', url: 'https://jetsmart.com/'});
  assert.equal((await f.run({action: 'close'})).state, 'closed');
  assert.deepEqual([...f.tabs.keys()], [99]);
  await f.run({action: 'close'});
  await assert.rejects(f.run({action: 'snapshot'}), /Open a booking page first/);
});

test('a completed old command cannot reply to a replacement connection', async () => {
  const f = fixture();
  f.connect();
  const first = f.connections[0];
  first.onMessage.listeners[0]({id: 1, action: 'version'});
  first.onDisconnect.listeners[0]();
  f.connect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(first.replies.length, 0);
  assert.equal(f.connections[1].replies.length, 0);
  // A delayed old disconnect must not disconnect the new transport either.
  first.onDisconnect.listeners[0]();
  f.connect();
  assert.equal(f.connections.length, 2);
});
