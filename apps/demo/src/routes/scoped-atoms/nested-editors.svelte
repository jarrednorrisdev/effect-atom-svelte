<script lang="ts">
  import NoteEditor from "./note-editor.svelte";
</script>

<!-- Both provide Draft. The reply's parts get the reply's draft: Draft.use()
     returns the nearest provider's atom. -->
<NoteEditor kind="scoped" name="Post">
  <NoteEditor kind="scoped" name="Reply" />
</NoteEditor>
