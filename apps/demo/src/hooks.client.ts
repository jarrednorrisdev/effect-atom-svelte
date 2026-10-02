import type { HandleClientError } from "@sveltejs/kit/hooks";

// SvelteKit passes errors through this hook before a <svelte:boundary> failed snippet sees them;
// without it the snippet only gets { status: 500, message: "Internal Error" }. Keep the message
// and an Effect error's _tag so failed snippets can show what went wrong.
export const handleError: HandleClientError = ({ error }) => ({
  message: error instanceof Error ? error.message : String(error),
  tag:
    typeof error === "object" && error !== null && "_tag" in error
      ? String(error._tag)
      : undefined,
});
