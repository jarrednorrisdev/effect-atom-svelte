import type { HandleClientError } from "@sveltejs/kit/hooks";
import { handleClientError } from "effect-atom-svelte/sveltekit";

// Keeps the message and an Effect error's _tag for <svelte:boundary> failed snippets, which would
// otherwise only get { status: 500, message: "Internal Error" }.
export const handleError: HandleClientError = handleClientError;
