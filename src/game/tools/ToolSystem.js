import { BLOCK_RULES, TOOL_KINDS, TOOL_TIERS } from "./toolConfig.js";

export function createTool(tier, kind) {
  const config = TOOL_TIERS[tier];
  if (!config) throw new RangeError(`Unknown tool tier: ${tier}`);
  if (!TOOL_KINDS.includes(kind)) throw new RangeError(`Unknown tool kind: ${kind}`);
  return { id: `${tier}_${kind}`, tier, kind, durability: config.durability, maxDurability: config.durability };
}

export function inspectMining(blockId, tool = null) {
  const block = BLOCK_RULES[blockId];
  if (!block) throw new RangeError(`Unknown block rule: ${blockId}`);
  const tier = tool ? TOOL_TIERS[tool.tier] : null;
  const correctKind = Boolean(tool && tool.kind === block.preferredTool);
  const hasTier = (tier?.level ?? 0) >= block.minTier;
  const canHarvest = block.minTier === 0 || (correctKind && hasTier);
  const speed = correctKind && tier ? tier.speed : 1;
  return {
    canHarvest,
    drops: canHarvest ? [block.drop] : [],
    speed,
    breakSeconds: Number((block.hardness * 1.5 / speed).toFixed(3)),
    requiredTool: block.preferredTool,
    requiredTier: block.minTier,
  };
}

export function mineBlock(blockId, tool = null) {
  if (tool && tool.durability <= 0) throw new Error(`${tool.id} is broken`);
  const mining = inspectMining(blockId, tool);
  const nextTool = tool ? { ...tool, durability: tool.durability - 1 } : null;
  return { ...mining, tool: nextTool, toolBroke: Boolean(nextTool && nextTool.durability === 0) };
}
