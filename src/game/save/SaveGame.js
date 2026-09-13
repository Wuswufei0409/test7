import { Inventory } from '../inventory/Inventory.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'bedrock-web.world.v1';

function checksum(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function validateVector(value, name) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid ${name}`);
  }
}

export function validateGameState(state) {
  if (!state || state.version !== SAVE_VERSION) throw new Error('Unsupported save version');
  if (!Number.isInteger(state.seed) || !Number.isFinite(state.time)) throw new Error('Invalid world header');
  validateVector(state.player?.position, 'player position');
  Inventory.deserialize(state.inventory);
  if (!Array.isArray(state.changedBlocks) || !Array.isArray(state.entities)) throw new Error('Invalid world collections');
  if (!state.containers || typeof state.containers !== 'object' || Array.isArray(state.containers)) {
    throw new Error('Invalid container state');
  }
  return state;
}

export function encodeGameState(state) {
  validateGameState(state);
  const payload = JSON.stringify(state);
  return JSON.stringify({ format: 'bedrock-web-save', checksum: checksum(payload), payload });
}

export function decodeGameState(serialized) {
  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch {
    throw new Error('Save is not valid JSON');
  }
  if (envelope?.format !== 'bedrock-web-save' || typeof envelope.payload !== 'string') {
    throw new Error('Save envelope is invalid');
  }
  if (checksum(envelope.payload) !== envelope.checksum) throw new Error('Save checksum mismatch');
  let state;
  try {
    state = JSON.parse(envelope.payload);
  } catch {
    throw new Error('Save payload is invalid');
  }
  return validateGameState(state);
}

export function saveToStorage(storage, state, key = SAVE_KEY) {
  const encoded = encodeGameState(state);
  storage.setItem(key, encoded);
  return encoded.length;
}

export function loadFromStorage(storage, createFallback, key = SAVE_KEY) {
  const raw = storage.getItem(key);
  if (raw === null) return { ok: true, state: createFallback(), source: 'new' };
  try {
    return { ok: true, state: decodeGameState(raw), source: 'saved' };
  } catch (cause) {
    return {
      ok: false,
      state: createFallback(),
      source: 'fallback',
      error: { code: 'CORRUPT_SAVE', message: cause.message },
    };
  }
}

export function createGameState({ seed, player, inventory, time = 0, world, containers = {}, entities = [] }) {
  return {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    player: structuredClone(player),
    inventory: inventory.serialize(),
    time,
    changedBlocks: world.serializeChanges(),
    containers: structuredClone(containers),
    entities: structuredClone(entities),
  };
}

