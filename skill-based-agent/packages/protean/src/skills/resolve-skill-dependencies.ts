import {
  DependencyResolutionError,
  type AppError,
  UnknownSkillError,
} from "../errors";
import { type SkillDefinition, type SkillId } from "./base";

type ResolveResult =
  | { ok: true; order: SkillId[] }
  | { ok: false; error: AppError };

/**
 * Topologically resolves requested skills and their transitive dependencies.
 * Returns stable post-order so dependencies always appear before dependents.
 */
export function resolveSkillLoadOrder(
  skillMap: Map<SkillId, SkillDefinition<unknown>>,
  requestedIds: SkillId[],
): ResolveResult {
  const order: SkillId[] = [];
  const visiting = new Set<SkillId>();
  const visited = new Set<SkillId>();

  const visit = (id: SkillId): ResolveResult => {
    const skill = skillMap.get(id);
    if (!skill) {
      return {
        ok: false,
        error: new UnknownSkillError(id, [...skillMap.keys()]),
      };
    }

    if (visited.has(id)) {
      return { ok: true, order: [] };
    }

    if (visiting.has(id)) {
      return {
        ok: false,
        error: new DependencyResolutionError(id, "dependency cycle detected"),
      };
    }

    visiting.add(id);

    for (const depId of skill.metadata.dependencies) {
      const depResult = visit(depId);
      if (!depResult.ok) {
        return depResult;
      }
    }

    visiting.delete(id);
    visited.add(id);
    order.push(id);
    return { ok: true, order: [] };
  };

  for (const id of requestedIds) {
    const result = visit(id);
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true, order };
}
