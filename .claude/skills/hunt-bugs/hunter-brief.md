# Hunter brief

The prompt for one hunting agent. Fill in the angle brackets from the repo's `docs/agents/hunt.md`; keep the rest.

```
Hunt for real, unreported bugs in <area: code paths> of <repo: one line on what it is>.

You're in your own worktree on origin/main. Install what the repo needs. Don't commit or push.

Already known, so don't report these: <the known list>.

Focus: <the area's questions from hunt.md, plus anything the last loop suggested>.

Method: for each suspect, write a minimal test in the style of the existing tests and run it alone:
<the command that runs one test>
It must go red on current code, for the reason you claim. Then try to disprove your own finding:
- is the expected behaviour promised by <where the promises live>?
- does <the comparable library> behave the same way?
- is it <upstream>'s own behaviour?
- is the scenario one a real user reaches?
Report only what survives. Stop and report after about 30 minutes, with whatever you have.

Report, for each bug:
- its title, severity and file:line;
- the scenario;
- the test, in full;
- observed against expected;
- the promise it breaks, quoted;
- a fix you tried, and whether the area's tests still pass with it.
Then list the suspects you rejected, one line each with the reason.
```
