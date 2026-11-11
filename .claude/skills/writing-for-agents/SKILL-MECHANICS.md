# Skill mechanics

The skill-specific branch of [`writing-for-agents`](SKILL.md): what changes when the document is a skill (frontmatter and invocation). Everything else about writing it is the universal reference in `SKILL.md`.

## Invocation

Every skill here is **model-invoked**: launched threads load their skills through the Skill tool, and other skills reach a skill by name, so none sets `disable-model-invocation`. You can still type its name: model-invocation always _includes_ user reach.

The price is context load. The `description` is the skill's top-level context pointer, loaded in every session of every repo the skill is synced into, whether or not it fires. Write it model-facing, carrying the trigger branches (the pointer-writing rules in `SKILL.md` apply in full), and prune it harder than the body. A skill that only ever fires by hand still pays this: its description can be a single line naming when Jarred asks for it.

A model-invoked skill whose content is all reference is also one home for shared reference: another skill can invoke it, so reference needed by several skills lives in one place.

## Splitting by invocation

The invocation cut of splitting (the sequence cut lives in `SKILL.md`): split off a skill when you have a distinct leading word that should trigger it on its own (a trigger word you actually use in your prompts), or another skill must reach it. You pay context load for the new always-loaded description, so that independent reach has to be worth it.
