---
"effect-atom-svelte": patch
---

Form: a tuple element that comes after a rest element (`Schema.TupleWithRest(head, [rest, last])`) now gets its own HTML constraints from `field.constraints`, not the rest element's (#68). Which index is the last element follows the array's current length, as it does when Effect decodes it.
