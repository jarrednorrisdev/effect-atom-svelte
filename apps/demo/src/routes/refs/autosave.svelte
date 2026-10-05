<script lang="ts">
  import { Equal } from "effect";
  import { AtomRef } from "effect/reactivity";
  import Part from "#lib/docs/kit/part.svelte";

  import ProfileField from "./profile-field.svelte";
  import { saveProfile } from "./profile-api.ts";
  import type { Profile } from "./profile-api.ts";

  // The form's draft.
  const profile = AtomRef.make<Profile>({ name: "Ada Lovelace", role: "Engineer" });

  interface Request {
    readonly sent: Profile;
    status: "sending" | "saved" | "tidied";
  }
  const requests = $state<Request[]>([]);

  const save = async (sent: Profile) => {
    requests.push({ sent, status: "sending" });
    const request = requests.at(-1);
    const stored = await saveProfile(sent);
    if (request) {
      request.status = Equal.equals(stored, sent) ? "saved" : "tidied";
    }
    // The server's copy wins, unless you've typed since. If it equals the draft, the ref
    // ignores it, so nothing saves again. If the server tidied it, it's a change, and saves once.
    if (profile.value === sent) {
      profile.set(stored);
    }
  };

  // Autosave: every change to the draft saves it, half a second after the last one.
  $effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = profile.subscribe((value) => {
      clearTimeout(timer);
      timer = setTimeout(() => save(value), 500);
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  });
</script>

<div class="grid gap-3 sm:grid-cols-2">
  <Part code label="autosave.svelte">
    <ProfileField label="Name" ref={profile.prop("name")} />
    <ProfileField label="Role" ref={profile.prop("role")} />
  </Part>
  <Part code count={requests.length} countLabel="requests" label="PUT /profile">
    <ol aria-label="Requests" class="m-0 flex list-none flex-col gap-1 p-0 text-sm">
      {#each requests.slice(-5) as { sent, status }, index (index)}
        <li class="m-0 flex items-baseline justify-between gap-2">
          <code class="truncate">"{sent.name}", "{sent.role}"</code>
          <span class={["status shrink-0", status]}>
            {status === "sending" ? "saving…" : status === "saved" ? "saved" : "saved, tidied"}
          </span>
        </li>
      {:else}
        <li class="m-0 text-muted-foreground">No requests yet. Edit the form.</li>
      {/each}
    </ol>
  </Part>
</div>

<style>
  .status {
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }
  .saved {
    color: var(--tone-success-text);
  }
  .tidied {
    color: var(--tone-running-text);
  }
</style>
