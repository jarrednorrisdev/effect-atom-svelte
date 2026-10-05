<script lang="ts">
  import NoteEditor from "./note-editor.svelte";
</script>

<!-- Both provide Draft. The reply's parts get the reply's draft: Draft.use()
     returns the nearest provider's atom. -->
<NoteEditor name="Post">
  <NoteEditor name="Reply" />
</NoteEditor>
