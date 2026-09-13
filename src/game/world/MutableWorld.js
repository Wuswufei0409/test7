import { AIR, getBlockDefinition } from '../blocks/catalog.js';

const R2_NAMES = new Map([
  [0, AIR], [1, 'stone'], [2, 'dirt'], [3, 'grass'], [4, 'sand'],
  [5, 'sandstone'], [7, 'bedrock'], [8, 'water'], [13, 'gravel'],
  [17, 'oak_log'], [18, 'oak_leaves'], [78, 'snow'],
]);

function key(x, y, z) {
  return `${x},${y},${z}`;
}

function parseKey(value) {
  return value.split(',').map(Number);
}

export class MutableWorld {
  constructor(baseWorld = null) {
    this.baseWorld = baseWorld;
    this.changes = new Map();
  }

  getBlock(x, y, z) {
    const changed = this.changes.get(key(x, y, z));
    if (changed !== undefined) return changed;
    if (!this.baseWorld) return AIR;
    const raw = typeof this.baseWorld.getBlock === 'function'
      ? this.baseWorld.getBlock(x, y, z)
      : this.baseWorld.blockAt(x, y, z);
    return typeof raw === 'string' ? raw : (R2_NAMES.get(raw) ?? AIR);
  }

  setBlock(x, y, z, blockId) {
    if (blockId !== AIR && !getBlockDefinition(blockId)) throw new Error(`Unknown block: ${blockId}`);
    this.changes.set(key(x, y, z), blockId);
  }

  isSolid(x, y, z) {
    return getBlockDefinition(this.getBlock(x, y, z))?.solid === true;
  }

  serializeChanges() {
    return [...this.changes.entries()]
      .map(([position, blockId]) => ({ position: parseKey(position), blockId }))
      .sort((a, b) => a.position.join(',').localeCompare(b.position.join(',')));
  }

  applyChanges(changes) {
    if (!Array.isArray(changes)) throw new Error('Invalid changed-block list');
    for (const change of changes) {
      if (!Array.isArray(change.position) || change.position.length !== 3) throw new Error('Invalid block position');
      this.setBlock(...change.position, change.blockId);
    }
  }
}

