import type { HandleServerError } from "@sveltejs/kit/hooks";
import { handleServerError } from "effect-atom-svelte/sveltekit";

// Keeps an Effect error's _tag for failed snippets rendered on the server, but not its message.
export const handleError: HandleServerError = handleServerError;
