# Left rail expand lag (note editor)

Hiding / extending the left rail on `/n/:id` blocked the main thread
for hundreds of milliseconds. This is how it was found and fixed.

## Symptom

- Only the note editor lagged. Every other page with a left rail felt
  fine.
- **Expanding** was the bad direction; collapsing was smooth.
- The lag scaled with the note: a heading-heavy note was much worse
  than an empty one.

## How it was investigated

Static reading did not show an obvious render storm, so the app was
driven in a real browser and measured.

1. **Run the app with fake data.** The dev build can run without a
   backend via the `UseFakeApi` MSW flag. The flag is persisted in
   `localStorage` under `feature-flags`.
2. **Drive it with CDP.** Edge was launched headless with
   `--remote-debugging-port` and a non-default `--user-data-dir`. A
   small Node script (built-in `WebSocket`, no puppeteer) connected to
   the page target and used `Runtime.evaluate` to navigate, set the
   feature flag and click the rail toggle.
3. **Measure long tasks, not just renders.** A tiny
   `PerformanceObserver` for `longtask` was installed in the page, reset
   right before the click, and read back after the transition. Counting
   React renders alone missed the problem entirely.
4. **Vary the payload to isolate the cost.** The MSW fixture note was
   temporarily grown to 2400 paragraphs / 300 headings, then to many
   paragraphs with almost no headings, then reverted. That separated the
   shell cost from the panel-content cost.

Measured long tasks (`ms`) while toggling the rail:

| Note | Action | Before fix |
|---|---|---|
| tiny | expand | `[166]` |
| tiny | collapse | `[]` |
| 300 headings + 2400 paragraphs | expand | `[458, 78, 56]` |
| 300 headings + 2400 paragraphs | collapse | `[]` |

Expanding was the only expensive direction, and it got much worse with
more headings.

## Root cause

`LeftRail` unmounted its panel content while collapsed:

```tsx
{!isCollapsed && <Box ...>{children}</Box>}
```

So every expand re-mounted `NoteLeftPanel` in the same frame as the
shell's `grid-template-columns` transition. On the note page that
rebuilds the directory hierarchy and re-renders the entire table of
contents. Collapsing was cheap because unmounting does no work.

`RightRail` never had this problem: it keeps its content mounted and
just clips it with `overflow: hidden`.

## Fix

Keep the left rail content mounted and hide it with `display: none`
instead of removing it from the React tree:

```tsx
<Box
  sx={{
    display: isCollapsed ? "none" : "flex",
    ...
  }}
>
  {children}
</Box>
```

File: `src/src/components/Rail/LeftRail.tsx`.

## Verification

Same harness after the fix:

| Note | Action | After fix |
|---|---|---|
| tiny | expand | `[]` |
| tiny | collapse | `[52]` |
| 300 headings + 2400 paragraphs | expand | `[53]` |
| 300 headings + 2400 paragraphs | collapse | `[65]` |

Expand dropped from ~600 ms to ~53 ms on the heavy note and from
166 ms to 0 on the empty one. `eslint` and `tsc -b` pass.

The remaining ~50 ms on collapse is the browser dropping the hidden
subtree from layout. If that ever matters, the next step is to keep the
content laid out but invisible (`visibility: hidden`) pinned to
`leftPanelSize`, the way `RightRail` does it.

## Takeaways

- Measure in the browser when the cost is not visible in React. Layout
  and paint do not show up in render counts.
- A `PerformanceObserver` on `longtask`, reset immediately before the
  interaction, is enough to reproduce a "feels laggy" report.
- Prefer keeping rail content mounted and clipping it over
  mount/unmounting on every collapse. Mounting is the expensive half.
