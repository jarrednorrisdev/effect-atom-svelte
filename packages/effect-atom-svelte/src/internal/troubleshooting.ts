// Where error messages point for more. Internal: not exported from the package.

/** The sentence that ends an error message: a link to its entry on the troubleshooting page. */
export const troubleshooting = (entry: string): string =>
  `See https://atom.jarrednorris.dev/troubleshooting#${entry}`;
