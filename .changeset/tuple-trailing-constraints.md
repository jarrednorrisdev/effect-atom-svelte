---
"effect-atom-svelte": patch
---

Form: a field after a tuple's rest element, as in `Schema.TupleWithRest(Schema.Tuple([A]), [B, C])`, now gets its own HTML constraints (`C`'s), not the rest element's. The trailing elements are counted from the array's end, as Effect's parser counts them, so a field's constraints follow the array as it grows (#68).
