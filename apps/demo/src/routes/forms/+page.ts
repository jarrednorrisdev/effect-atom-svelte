// The rename example needs the demo API, so the page is only prerendered when the build runs the
// API itself.
export { inTabApi as prerender } from "#lib/in-tab-api.ts";
