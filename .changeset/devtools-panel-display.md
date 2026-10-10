---
"effect-atom-svelte-devtools": patch
---

A failed atom's sheet now shows what it failed with, fields and all, such as `CityNotFound { city: "Atlantis" }`, above the full cause. Sheets write `NaN`, `Infinity` and `undefined` fields as they are instead of showing `null` or dropping the field. A map whose keys are objects, or whose keys read the same as strings (`1` and `"1"`), is shown as `[key, value]` pairs so no entry is lost, and a map, set or object over 50 entries now says how many more it has, as arrays already did.

Clear empties the timeline while it is paused. The timeline's "only this atom" filter is dropped when the panel switches to another registry, instead of picking an unrelated atom there. The graph keeps the selected atom marked when the graph's layout changes.
