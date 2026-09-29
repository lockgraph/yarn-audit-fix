import type { RegistryAdapter } from 'lockgraph'
import sv from 'semver'

/**
 * The two things the remediation asks a packument: which version clears an advisory,
 * and what a given version declares for one of its deps. They share one cache per run,
 * so the plan and the gates never fetch the same package twice.
 */
export const packumentLookups = (registry: RegistryAdapter) => {
  const cache = new Map<
    string,
    Awaited<ReturnType<RegistryAdapter['packument']>>
  >()
  const packument = async (name: string) => {
    if (!cache.has(name)) cache.set(name, await registry.packument(name))
    return cache.get(name)
  }

  return {
    /**
     * npm parity: the minimal fix is the lowest published version ABOVE the vulnerable
     * one that falls outside every vulnerable range — not the lowest that satisfies a
     * merged `patched_versions`. Advisories are split per major line these days, and
     * AND-ing their patched ranges (`>=1.1.12 >=2.1.4`) admits only the newest major,
     * so a package with a safe in-line fix was forced across a major boundary.
     * Prereleases are never offered as a fix: they satisfy "outside the vulnerable
     * range" trivially.
     */
    lowestFix: async (
      name: string,
      vulnerable: string,
      floor: string,
    ): Promise<string | undefined> => {
      const pack = await packument(name)
      if (!pack) return undefined
      return Object.keys(pack.versions)
        .filter(
          (v) =>
            sv.valid(v) &&
            sv.prerelease(v) === null &&
            sv.gt(v, floor) &&
            !sv.satisfies(v, vulnerable),
        )
        .sort(sv.compare)[0] // undefined ⇒ nothing published clears it
    },

    /**
     * Versions of `name` published above `floor`, lowest first, whose own declared range
     * for `dep` admits `fix` — the raises that would let a pinned transitive fix through.
     */
    versionsAdmitting: async (
      name: string,
      dep: string,
      fix: string,
      floor: string,
    ): Promise<string[]> => {
      const pack = await packument(name)
      if (!pack) return []
      return Object.keys(pack.versions)
        .filter(
          (v) => sv.valid(v) && sv.prerelease(v) === null && sv.gt(v, floor),
        )
        .sort(sv.compare)
        .filter((v) => {
          const range = (
            pack.versions[v] as { dependencies?: Record<string, string> }
          )?.dependencies?.[dep]
          return (
            range !== undefined &&
            sv.validRange(range) !== null &&
            sv.satisfies(fix, range)
          )
        })
    },

    /**
     * What `name@version` declares for `dep`, or undefined when it doesn't depend on it
     * at all. The consumer gate needs this to tell a consumer that will re-derive a dep
     * from one that carries the same pin into its next version.
     */
    declaredRange: async (
      name: string,
      version: string,
      dep: string,
    ): Promise<string | undefined> => {
      const manifest = (await packument(name))?.versions?.[version] as
        { dependencies?: Record<string, string> } | undefined
      return manifest?.dependencies?.[dep]
    },
  }
}
