<!--
  @component
  The site's name in the header: a small effect → atom → component graph, drawn like the nodes of
  the site's graphs, then the name in the same colours, so each word sits under its node.

  ```svelte
  <SiteLogo />
  ```
-->

<a class="logo" href="/">
  <span aria-hidden="true" class="mark"
    ><i class="effect"></i><i class="line"></i><i class="atom"></i><i class="line"></i><i class="component"></i></span
  >
  <span class="name"><span class="effect">effect-</span><span class="atom">atom</span><span class="svelte">-svelte</span></span>
</a>

<style>
  .logo {
    align-items: center;
    display: inline-flex;
    gap: 0.6rem;
    min-width: 0;
    white-space: nowrap;
  }
  .name {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name .effect {
    color: var(--foreground);
  }
  .name .atom {
    color: var(--brand-text);
  }
  .name .svelte {
    color: var(--muted-foreground);
  }
  /* A phone has no room for the name beside the controls: the mark stands in for it, and the name
     stays the link's name for screen readers. */
  @media (width < 40rem) {
    .name {
      clip-path: inset(50%);
      height: 1px;
      position: absolute;
      width: 1px;
    }
  }
  /* Odd sizes centred on a 1px line, as the graphs' nodes are. */
  .mark {
    align-items: center;
    display: inline-flex;
    flex: none;
    height: 11px;
  }
  .mark i {
    box-sizing: border-box;
    display: block;
    flex: none;
  }
  .mark .line {
    background: var(--muted-foreground);
    height: 1px;
    width: 7px;
  }
  .mark .effect {
    background: var(--foreground);
    height: 7px;
    margin-inline: 1px;
    rotate: 45deg;
    width: 7px;
  }
  .mark .atom {
    border: 2px solid var(--brand);
    border-radius: 50%;
    height: 11px;
    width: 11px;
  }
  .mark .component {
    border: 1px solid var(--muted-foreground);
    border-radius: 1.5px;
    height: 9px;
    width: 9px;
  }
</style>
