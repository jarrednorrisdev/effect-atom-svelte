<script lang="ts">
  import { useAtomValue } from "effect-atom-svelte";

  import DraftPart from "./draft-part.svelte";
  import { Draft } from "./draft-scope.ts";

  interface Segment {
    readonly style: "bold" | "italic" | "plain";
    readonly text: string;
  }

  // Markdown's emphasis: **bold** and *italic*.
  const emphasis = (text: string): Segment[] =>
    text
      .split(/(?<emphasis>\*\*[^*]+\*\*|\*[^*]+\*)/u)
      .filter((part) => part !== "")
      .map((part) => {
        if (/^\*\*[^*]+\*\*$/u.test(part)) {
          return { style: "bold", text: part.slice(2, -2) };
        }
        if (/^\*[^*]+\*$/u.test(part)) {
          return { style: "italic", text: part.slice(1, -1) };
        }
        return { style: "plain", text: part };
      });

  // A transform: the preview reads the draft already split into styled parts.
  const segments = useAtomValue(Draft.use(), emphasis);
</script>

<DraftPart name="Preview">
  {#if segments.current.every((segment) => segment.text.trim() === "")}
    <span class="text-sm text-muted-foreground">Nothing written yet.</span>
  {:else}
    <p class="m-0">
      {#each segments.current as segment, index (index)}
        {#if segment.style === "bold"}
          <strong>{segment.text}</strong>
        {:else if segment.style === "italic"}
          <em>{segment.text}</em>
        {:else}
          {segment.text}
        {/if}
      {/each}
    </p>
  {/if}
</DraftPart>
