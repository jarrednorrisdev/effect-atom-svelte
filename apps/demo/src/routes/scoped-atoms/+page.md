---
title: Scoped atoms
description: Give each part of the page its own atom, without passing it down by hand.
---

<script>
  import Admin from "./admin.svelte";
  import adminSource from "./admin.svelte?highlight";
  import dataTableSource from "./data-table.svelte?highlight";
  import tableFooterSource from "./table-footer.svelte?highlight";
  import tableHeaderSource from "./table-header.svelte?highlight";
  import tableRowsSource from "./table-rows.svelte?highlight";
  import tableScopeSource from "./table-scope.ts?highlight";
  import tableToolbarSource from "./table-toolbar.svelte?highlight";
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import OrderItems from "./order-items.svelte";
  import orderItemsSource from "./order-items.svelte?highlight";
</script>

An atom defined at module level is one atom for the whole app. Sometimes each instance of a component needs its own, and the components inside it need to find it without having it passed down. A data table is the classic case: its search box, column headers, rows and footer are separate components that all read and change the same sort, search, page and selection, and a page with two tables needs two of each. A **scoped atom** is created by the component that provides it, and every component below that one reads the same atom.

Below, an admin page shows an Orders table and a Customers table. Each `DataTable` provides its own state with `Table.provide()`: its rows, and how the reader is viewing them (search, sort, page and selection). Its toolbar, header, rows and footer take no props: each finds its table's state with `Table.use()`, so sorting, searching or selecting in one table leaves the other alone. Turn on **X-ray** to outline each table that provides its own state:

<Example files={[{ html: tableScopeSource, name: "table-scope.ts" }, { html: adminSource, name: "admin.svelte" }, { html: dataTableSource, name: "data-table.svelte" }, { html: tableToolbarSource, name: "table-toolbar.svelte" }, { html: tableHeaderSource, name: "table-header.svelte" }, { html: tableRowsSource, name: "table-rows.svelte" }, { html: tableFooterSource, name: "table-footer.svelte" }]} hint="Sort the orders by total, search for Ada and select an order: the customers table doesn't change. Then turn on X-ray to outline each table that provides its own state."> <Admin /> </Example>

The pattern isn't about tables: any widget made of parts that share state, used more than once or opened fresh each time, fits it, such as a media player and its controls, or a form and its fields.

<Aside type="note" title="Why not a family keyed by a table id?">

`tableState("orders")` would work too, but someone has to choose an id for every table and keep them unique, and every part has to be given that id. A scoped atom needs neither: the table component is the identity, and the state lives exactly as long as it does. That's what these tables want: their search, sort and page are throwaway, and should go when the table does. Use a family when the state belongs to something your app identifies by an id or name, such as a user or an order, rather than to one copy of a reusable component. If the Orders table should remember its sort after the reader navigates away, that state belongs to the name "orders", and the two combine: see [Using both](#using-both).

</Aside>

## Defining a scoped atom

`ScopedAtom.make` takes a function that builds the atom. It can take an input, which the providing component passes in, such as the table's rows and the column it sorts by at first (`Row` is the example's type for a row, in `table-scope.ts`):

```ts
import { ScopedAtom } from "effect-atom-svelte";
import { Atom } from "effect/reactivity";

export const Table = ScopedAtom.make(
  (options: { rows: readonly Row[]; sort: string }) =>
    Atom.make({ ...options, page: 0, query: "", selected: new Set<string>() }),
  { name: "Table" }
);
```

## Providing and using it

Call `provide` in the component that owns the atom. It runs the function once for that component, puts the atom in Svelte's context, and returns it:

```svelte
<script lang="ts">
  const { rows, sort } = $props();
  // svelte-ignore state_referenced_locally
  const table = Table.provide({ rows, sort });
  useAtomMount(table);
</script>
```

The function runs once, so `provide` reads its input once: a later change to `rows` doesn't make a new atom. The `svelte-ignore` comment says that reading the prop once is intended.

`provide` only puts the atom in context; it doesn't hold it. If every component below that reads the atom unmounts, the registry disposes of it, and the next reader starts from the initial value. `useAtomMount` in the providing component holds it for as long as that component lives. `Atom.keepAlive` in the function would hold it too, but for as long as the registry lives, long after the component has gone. See [Lifetimes](/lifetimes).

Call `use` in any component below it to get the same atom, then read it with the usual hooks:

```svelte
<script lang="ts">
  const table = useAtom(Table.use());
</script>
```

If a component is inside more than one provider, `use` returns the nearest one's atom. Below, an order expands to show its line items: a smaller `DataTable` inside the Orders table, so both provide `Table`. The line items' toolbar, header, rows and footer call the same `Table.use()` as the orders', and get the line items' state, because theirs is the nearest provider. The line items' table is created when the order expands, so collapsing the order and expanding it again starts it afresh:

<Example files={[{ html: orderItemsSource, name: "order-items.svelte" }, { html: dataTableSource, name: "data-table.svelte" }, { html: tableRowsSource, name: "table-rows.svelte" }, { html: tableScopeSource, name: "table-scope.ts" }]} hint="Select a line item and sort them by price: the orders don't change. Collapse the order and expand it again: its line items start afresh. Turn on X-ray to outline both tables, one inside the other."> <OrderItems /> </Example>

<Aside type="caution" title="use needs a provider above it">

`use` throws if no component above it called `provide`. Like any Svelte context, both must run while the component initializes, at the top level of its script. Give `make` a name, as in `ScopedAtom.make(f, { name: "Table" })`, and the error says which scoped atom it was.

</Aside>

## Scoped atoms or families?

Both turn one definition into many atoms: a family makes one per input, and a scoped atom one per provider. Inside a provider, `use()` gives you that provider's atom. Choose by what the state belongs to:

- **Something your app identifies by an id or name**, such as a user, an order or a todo: use a family.
- **One copy of a reusable component**, such as this table, this dialog or this mount: use a scoped atom.

How the two differ:

- A [family](/families) is keyed by a value. Any component can ask for `todoAtom(1)` and gets the same atom wherever it asks.
- A scoped atom is keyed by its place in the component tree. Only components below the provider can reach it, and two providers make two atoms even with the same input.

Either way, the atom's value lives in the registry, and the usual [lifetimes](/lifetimes) apply.

### Using both

Sometimes state belongs to an id, but the components that use it would rather not be given the id. Say the Orders table should remember its search, sort and page when the reader navigates away and comes back. That state belongs to the name "orders", not to the mounted table, so it's a family's job. But the table's toolbar, header, rows and footer should still find it with `Table.use()`, without being passed the name, and that's a scoped atom's job.

Let the scoped atom provide the family's atom. This is a variant of `Table` that takes the table's name instead of its rows:

```ts
// One state per table name, kept after the table unmounts.
const tableState = Atom.family((name: string) =>
  Atom.make({
    page: 0,
    query: "",
    selected: new Set<string>(),
    sort: "date",
  }).pipe(Atom.keepAlive)
);

// A table calls Table.provide("orders"); its parts still call Table.use().
export const Table = ScopedAtom.make((name: string) => tableState(name), {
  name: "Table",
});
```

The parts don't change. The family decides which atom a name gets and how long it lives: mount the Orders table again and it gets the same atom back, with its sort and page as the reader left them. The scoped atom decides who can reach it: only the components inside that table. Two tables provided with the same name now share their state, which is what the name means here.

Server-rendered data is a common case for this combination: if a scoped atom's atom is serializable, two providers that make atoms with the same key, such as two with the same input, make the server render throw. See [Scoped atoms](/hydration#scoped-atoms) on the Hydration page.
