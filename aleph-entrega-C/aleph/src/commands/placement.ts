import { betweenMany, needsReindex, spread } from '../domain/order';
import type { Id } from '../domain/types';
import type { CommandTx } from './changeset';

/**
 * Calcula `count` claves de orden consecutivas para colocar elementos en
 * `index` entre los hijos vivos de `parentId` (sin contar los de `exclude`,
 * que son los que se están moviendo). Si las claves se han vuelto largas,
 * reindexa a los hermanos dentro de la misma transacción.
 */
export async function allocateOrders(
  tx: CommandTx,
  workspaceId: Id,
  parentId: Id | null,
  index: number | undefined,
  count: number,
  exclude: ReadonlySet<Id> = new Set(),
): Promise<string[]> {
  const siblings = (await tx.listChildren(workspaceId, parentId)).filter((n) => !exclude.has(n.id));
  const at = Math.min(Math.max(index ?? siblings.length, 0), siblings.length);
  const before = siblings[at - 1]?.order ?? null;
  const after = siblings[at]?.order ?? null;
  const keys = betweenMany(before, after, count);
  if (!keys.some(needsReindex)) return keys;

  const all = spread(siblings.length + count);
  for (let i = 0; i < siblings.length; i += 1) {
    const sib = siblings[i]!;
    const order = all[i < at ? i : i + count]!;
    if (sib.order !== order) await tx.updateNode(sib.id, { order });
  }
  return all.slice(at, at + count);
}
