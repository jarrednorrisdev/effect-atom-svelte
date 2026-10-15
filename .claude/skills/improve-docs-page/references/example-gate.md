# The example gate

Score every candidate example against each question. A candidate with a "no" is dropped, not patched.

1. **Does a real app have this situation?** Name the app, or the kind of app. Two text boxes mirroring each other, or a dashboard with a live toggle between two layouts, fail here.
2. **Does the situation arise without staging?** The example shows what an app already does, not a mistake set up so the feature can prevent it. A comparison switch ("one shared X") is a smell: prefer a setup where both cases appear naturally.
3. **Does the reader know everything it uses?** Check `apps/demo/src/lib/docs/nav.ts`: anything from a later page (async, server rendering, hydration) belongs on that page, linked from here.
4. **Does it argue only this page's point?** A page earlier in the sidebar has already made its own argument (such as "why atoms"); the example doesn't repeat it.
5. **Is its state on the right side of the page's distinctions?** For example, state belonging to something the app identifies by an id is a family's, state belonging to one copy of a component a scoped atom's. An example that blurs the page's own rule invites the question it should answer.
6. **Is it small enough to read?** Fake data and synchronous logic beat a realistic backend that buries the point.

The scoped-atoms page went through note editors, feed composers and dashboard cards before landing on an admin page's data tables (two tables on one page, and line items nested in an expanded order), which pass all six.
