<script lang="ts">
  import DatabaseBackupIcon from "@lucide/svelte/icons/database-backup";
  import { Button } from "#lib/components/ui/button/index.ts";
  import { inTabApi } from "#lib/in-tab-api.ts";

  let resetting = $state(false);

  // The demo API's todos start from the same seed again. On the hosted site the API runs in this
  // tab, so reloading the page is the reset; in dev the API is a server, which is told first. The
  // page reloads either way, so every example reads the fresh data.
  const reset = async () => {
    resetting = true;
    if (!inTabApi) {
      try {
        await fetch("/api/__reset", { method: "POST" });
      } catch {
        // The API is down; the reload shows that.
      }
    }
    location.reload();
  };
</script>

<Button
  aria-label="Reset the demo API"
  disabled={resetting}
  onclick={reset}
  size="icon-sm"
  title="Reset the demo API: its todos go back to the start, and the page reloads"
  variant="ghost"
>
  <DatabaseBackupIcon />
</Button>
