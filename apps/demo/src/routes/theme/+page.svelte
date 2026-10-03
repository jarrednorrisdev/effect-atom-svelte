<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Command from "#lib/components/ui/command/index.ts";
  import { Input } from "#lib/components/ui/input/index.ts";
  import * as Sheet from "#lib/components/ui/sheet/index.ts";
  import { Skeleton } from "#lib/components/ui/skeleton/index.ts";

  import Content from "./content.md";

  // A test page for the theme (JND-44): shadcn components and code blocks, in light and dark.
  let dark = $state(false);
  let commandOpen = $state(false);

  $effect(() => {
    document.documentElement.classList.toggle("dark", dark);
  });
</script>

<div class="space-y-10 font-sans">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold tracking-tight">Theme</h1>
    <Button variant="outline" onclick={() => (dark = !dark)}>
      {dark ? "Light" : "Dark"}
    </Button>
  </div>

  <div class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
    <div class="flex max-w-sm gap-2">
      <Input placeholder="Search the docs" />
      <Button variant="outline" onclick={() => (commandOpen = true)}>
        Command
      </Button>
      <Sheet.Root>
        <Sheet.Trigger>
          {#snippet child({ props })}
            <Button variant="outline" {...props}>Sheet</Button>
          {/snippet}
        </Sheet.Trigger>
        <Sheet.Content side="left">
          <Sheet.Header>
            <Sheet.Title>Getting started</Sheet.Title>
            <Sheet.Description>
              Navigation on small screens opens in a sheet.
            </Sheet.Description>
          </Sheet.Header>
        </Sheet.Content>
      </Sheet.Root>
    </div>
    <div class="flex gap-2">
      <Skeleton class="size-10 rounded-full" />
      <div class="space-y-2">
        <Skeleton class="h-4 w-60" />
        <Skeleton class="h-4 w-40" />
      </div>
    </div>
    <p class="text-sm text-muted-foreground">
      Muted text, <span class="text-subtle-foreground">subtle text</span> and
      <span class="text-brand">the brand colour</span>.
    </p>
  </div>

  <article class="prose prose-effect max-w-none">
    <Content />
  </article>
</div>

<Command.Dialog bind:open={commandOpen}>
  <Command.Input placeholder="Search the docs" />
  <Command.List>
    <Command.Empty>No results found.</Command.Empty>
    <Command.Group heading="Guides">
      <Command.Item>Getting started</Command.Item>
      <Command.Item>Server rendering</Command.Item>
    </Command.Group>
  </Command.List>
</Command.Dialog>
