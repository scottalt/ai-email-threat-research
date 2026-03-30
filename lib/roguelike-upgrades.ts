// ─── Permanent Upgrade Definitions (Phase 2) ────────────────────────────────

export type UpgradeId =
  // Survival
  | 'THICK_SKIN' | 'FIELD_MEDIC' | 'SECOND_WIND' | 'LAST_STAND'
  // Intelligence
  | 'ANALYST_EYE' | 'DEEP_NETWORK' | 'SIGNAL_INTERCEPT' | 'OMNISCIENCE'
  // Profit
  | 'HAZARD_PAY' | 'BLACK_MARKET' | 'HIGH_ROLLER' | 'INSIDER_TRADING';

export type UpgradeBranch = 'survival' | 'intelligence' | 'profit';

export interface UpgradeDef {
  id: UpgradeId;
  branch: UpgradeBranch;
  tier: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  cost: number; // Clearance cost
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  // Survival branch
  { id: 'THICK_SKIN',       branch: 'survival',     tier: 1, name: 'THICK SKIN',       description: 'Start with 4 lives instead of 3',                cost: 20 },
  { id: 'FIELD_MEDIC',      branch: 'survival',     tier: 2, name: 'FIELD MEDIC',      description: 'Heal 1 life on floor clear (if below max)',       cost: 40 },
  { id: 'SECOND_WIND',      branch: 'survival',     tier: 3, name: 'SECOND WIND',      description: 'Unlock SHIELD perk in shop pool',                cost: 60 },
  { id: 'LAST_STAND',       branch: 'survival',     tier: 4, name: 'LAST STAND',       description: 'At 1 life, correct answers give +3 Intel bonus', cost: 80 },
  // Intelligence branch
  { id: 'ANALYST_EYE',      branch: 'intelligence', tier: 1, name: 'ANALYST EYE',      description: 'Start each run with 1 free inspection',          cost: 20 },
  { id: 'DEEP_NETWORK',     branch: 'intelligence', tier: 2, name: 'DEEP NETWORK',     description: 'Unlock REVEAL_CLUE perk in shop',                cost: 40 },
  { id: 'SIGNAL_INTERCEPT', branch: 'intelligence', tier: 3, name: 'SIGNAL INTERCEPT', description: 'Floor briefings reveal the gimmick name',         cost: 60 },
  { id: 'OMNISCIENCE',      branch: 'intelligence', tier: 4, name: 'OMNISCIENCE',      description: 'See all card modifiers before answering',         cost: 80 },
  // Profit branch
  { id: 'HAZARD_PAY',       branch: 'profit',       tier: 1, name: 'HAZARD PAY',       description: '+15% Intel from correct answers',                cost: 20 },
  { id: 'BLACK_MARKET',     branch: 'profit',       tier: 2, name: 'BLACK MARKET',     description: 'Perk shop shows 4 options instead of 3',         cost: 40 },
  { id: 'HIGH_ROLLER',      branch: 'profit',       tier: 3, name: 'HIGH ROLLER',      description: 'Confidence wager unlocks on floor 2',            cost: 60 },
  { id: 'INSIDER_TRADING',  branch: 'profit',       tier: 4, name: 'INSIDER TRADING',  description: '10% discount on all perk prices',                cost: 80 },
];

export const BRANCH_COLORS: Record<UpgradeBranch, string> = {
  survival: '#00ff41',
  intelligence: '#00d4ff',
  profit: '#ffaa00',
};

export const BRANCH_LABELS: Record<UpgradeBranch, string> = {
  survival: 'SURVIVAL',
  intelligence: 'INTELLIGENCE',
  profit: 'PROFIT',
};

/** All branches in display order */
export const BRANCHES: UpgradeBranch[] = ['survival', 'intelligence', 'profit'];

/** Get upgrades for a specific branch, sorted by tier ascending */
export function getBranchUpgrades(branch: UpgradeBranch): UpgradeDef[] {
  return UPGRADE_DEFS.filter(u => u.branch === branch).sort((a, b) => a.tier - b.tier);
}

/** Check if a player can purchase an upgrade (must own all lower tiers in same branch) */
export function canPurchaseUpgrade(
  upgradeId: UpgradeId,
  ownedUpgrades: UpgradeId[],
  clearance: number,
): { canBuy: boolean; reason?: string } {
  const def = UPGRADE_DEFS.find(u => u.id === upgradeId);
  if (!def) return { canBuy: false, reason: 'Unknown upgrade' };
  if (ownedUpgrades.includes(upgradeId)) return { canBuy: false, reason: 'Already owned' };
  if (clearance < def.cost) return { canBuy: false, reason: 'Insufficient Clearance' };

  // Must own all lower tiers in the same branch
  const branchUpgrades = UPGRADE_DEFS.filter(u => u.branch === def.branch && u.tier < def.tier);
  const missingPrereqs = branchUpgrades.filter(u => !ownedUpgrades.includes(u.id));
  if (missingPrereqs.length > 0) {
    return { canBuy: false, reason: `Requires ${missingPrereqs[0]!.name} first` };
  }

  return { canBuy: true };
}

/** Check if a player owns a specific upgrade */
export function hasUpgrade(ownedUpgrades: UpgradeId[], upgradeId: UpgradeId): boolean {
  return ownedUpgrades.includes(upgradeId);
}
