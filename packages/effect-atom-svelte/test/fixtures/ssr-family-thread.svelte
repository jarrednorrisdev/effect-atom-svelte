<!-- A comment thread whose cards read their author from the family: Alice, Bob, then Alice again. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import FamilyComment from "./family-comment.svelte";

  const comments = [{ authorId: "a" }, { authorId: "b" }, { authorId: "a" }];
</script>

<RegistryProvider>
  {#each comments as comment, i (i)}
    <FamilyComment authorId={comment.authorId} />
  {/each}
</RegistryProvider>
