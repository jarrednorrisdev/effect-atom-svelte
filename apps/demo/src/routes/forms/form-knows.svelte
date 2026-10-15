<!--
  @component
  Beside the sign-up example, not part of it: per field, the latest check (`field.issue`), whether
  the user has left it, and whether its error is on screen (`field.error`), so the reader can see
  the Schema check every change while the timing decides what shows.
-->
<script lang="ts">
  import type { Form } from "effect-atom-svelte";

  interface Props {
    readonly fields: Readonly<
      Record<string, Form.Field<unknown>>
    >;
    readonly valid: boolean;
  }

  const { fields, valid }: Props = $props();
</script>

<section
  aria-label="What the form knows"
  class="knows"
  data-testid="form-knows"
>
  <p class="knows-title">What the form knows</p>
  <table>
    <thead>
      <tr
        ><th>field</th><th>latest check</th><th>touched</th
        ><th>on screen</th></tr
      >
    </thead>
    <tbody>
      {#each Object.entries(fields) as [name, field] (name)}
        <tr data-testid="knows-{name}">
          <td><code>{name}</code></td>
          <td class={field.issue ? "bad" : "ok"}
            >{field.issue ?? "passes"}</td
          >
          <td>{field.touched ? "yes" : "no"}</td>
          <td
            >{field.error
              ? "shown"
              : field.issue
                ? "hidden"
                : "—"}</td
          >
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="knows-valid">
    <code>form.valid</code>:
    <span
      class={valid ? "ok" : "bad"}
      data-testid="knows-valid">{valid}</span
    >
  </p>
</section>

<style>
  .knows {
    border: 1px solid var(--border);
    font-size: 0.8125rem;
    padding: 0.75rem 1rem;
  }
  .knows-title {
    color: var(--muted-foreground);
    font: 0.7rem var(--font-mono);
    letter-spacing: 0.08em;
    margin: 0 0 0.5rem;
    text-transform: uppercase;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th,
  td {
    border-bottom: 1px solid var(--border);
    padding: 0.25rem 0.375rem;
    text-align: left;
    vertical-align: top;
  }
  /* Cells may break anywhere, so the table fits a phone. */
  td {
    overflow-wrap: anywhere;
  }
  th {
    color: var(--muted-foreground);
    font-weight: 500;
  }
  .ok {
    color: var(--tone-success-text);
  }
  .bad {
    color: var(--tone-failure-text);
  }
  .knows-valid {
    margin: 0.5rem 0 0;
  }
</style>
