---
"effect-atom-svelte": minor
---

`provideRegistry` and `RegistryProvider` take either an existing `registry` or the `AtomRegistry.make` options for a new one, not both. The types now reject the combination, and a call without types throws instead of dropping the options silently. `ProvideRegistryOptions` is now a union of the new `ProvideExistingRegistry` and `ProvideNewRegistry` (JND-61).
