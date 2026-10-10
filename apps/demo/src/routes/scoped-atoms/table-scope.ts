import { ScopedAtom } from "effect-atom-svelte";
import { Atom } from "effect/reactivity";
import type { Snippet } from "svelte";

export interface Row {
  readonly id: string;
  readonly [column: string]: string | number;
}

export interface Column {
  readonly key: string;
  readonly label: string;
  /** Right-aligned and shown with `format`, such as a price. */
  readonly format?: (value: string | number) => string;
}

/** A table's state: its rows, and how the reader is viewing them (search, sort, page, selection). */
export interface TableState {
  readonly columns: readonly Column[];
  readonly descending: boolean;
  /** What an expanded row shows below it, for a table whose rows expand. */
  readonly details?: Snippet<[Row]> | undefined;
  /** The id of the row that is expanded, if any. */
  readonly expanded?: string | undefined;
  readonly name: string;
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  readonly rows: readonly Row[];
  readonly selected: ReadonlySet<string>;
  readonly sort: string;
}

// Table.provide(options) runs this once for each table that calls it, so every
// table gets its own search, sort, page and selection. The label is a name for
// the devtools only: two tables with the same name are still two atoms.
export const Table = ScopedAtom.make(
  (
    options: Pick<
      TableState,
      "columns" | "details" | "expanded" | "name" | "rows" | "sort"
    > & {
      readonly descending?: boolean;
    }
  ) => {
    const initial: TableState = {
      descending: false,
      ...options,
      page: 0,
      pageSize: 4,
      query: "",
      selected: new Set(),
    };
    return Atom.make(initial).pipe(Atom.withLabel(`${options.name} table`));
  },
  { name: "Table" }
);

/** The rows a table shows now: searched, then sorted, then cut to the page. */
export const visibleRows = (table: TableState) => {
  const query = table.query.trim().toLowerCase();
  const found = table.rows.filter(
    (row) =>
      query === "" ||
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(query)
      )
  );
  const sorted = found.toSorted((a, b) => {
    const order = String(a[table.sort]).localeCompare(
      String(b[table.sort]),
      undefined,
      {
        numeric: true,
      }
    );
    return table.descending ? -order : order;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / table.pageSize));
  const page = Math.min(table.page, pages - 1);
  return {
    page,
    pages,
    rows: sorted.slice(page * table.pageSize, (page + 1) * table.pageSize),
    total: sorted.length,
  };
};
