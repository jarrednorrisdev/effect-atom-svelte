<!--
  @component
  The guide to when to reach for atoms, as a table: what you need, and the rune or atom for it. The
  landing page's hero and the Why atoms page both show it, so the two can't disagree.

  ```svelte
  <AtomsGuide />
  ```
-->
<script lang="ts">
  import { guide, guideCaption } from "./atoms-guide.ts";
</script>

<div class="not-prose overflow-hidden rounded-xl border bg-background shadow-sm" data-testid="comparison">
  <table class="w-full text-left text-[0.8125rem] leading-snug">
    <caption class="border-b px-4 py-2.5 text-left text-xs font-medium sm:px-5">
      {guideCaption}
    </caption>
    <thead class="text-xs text-muted-foreground">
      <tr>
        <th class="w-[40%] px-4 py-2 font-medium sm:px-5" scope="col">You need</th>
        <th class="px-4 py-2 font-medium sm:px-5" scope="col">Reach for</th>
      </tr>
    </thead>
    <tbody>
      {#each guide as row (row.need)}
        <tr class="border-t align-top">
          <th class="px-4 py-2 font-medium sm:px-5" scope="row">{row.need}</th>
          <td class="px-4 py-2 sm:px-5">
            <span class={["font-medium", row.atoms && "text-brand-text"]}>{row.tool}</span>:
            <span class="text-muted-foreground">{row.why}</span>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
