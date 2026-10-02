---
"effect-atom-svelte": patch
---

Server rendering with a registry you pass in (`<RegistryProvider registry={...}>` or `provideRegistry({ registry })`) now releases each request's atoms when rendering ends, so they no longer pile up in the registry, and every request embeds its own hydration seeds instead of only the first (JND-17).
