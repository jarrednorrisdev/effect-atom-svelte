<!-- The sign-in form under its own registry, for rendering on the server. -->
<script lang="ts">
  import { RegistryProvider } from "../../src/index.ts";
  import FormSignIn from "./form-sign-in.svelte";
</script>

<RegistryProvider>
  <FormSignIn />
</RegistryProvider>
