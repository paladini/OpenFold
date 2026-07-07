# Desktop shell parity checklist

Manual smoke-test checklist (spec success criterion: "Zero behavior diffs vs. browser build in a
smoke checklist"). Run once per release candidate on each target OS; record results (date, OS,
build, pass/fail per row) in the release PR.

## Launch

- [ ] Binary launches with no network access enabled and completes a full round offline (spec DESK-01 AC3)
- [ ] Window opens titled "OpenFold" at 1280x800, centered, on first launch
- [ ] Window is not resizable below 960x640
- [ ] A second instance launched while the first is running exits without opening a second window
- [ ] Closing the window exits the process cleanly (check the OS process list/Task Manager for orphans)

## Window ergonomics

- [ ] Resize and move the window, quit, relaunch: size and position are restored
- [ ] Disconnect a second monitor the window was previously on, relaunch: window appears on the remaining monitor instead of off-screen
- [ ] Toggle OS dark/light mode while the app is running (or relaunch after toggling): window chrome follows

## Feature parity vs. the browser build

- [ ] Complete a full round (fold mode): identical net/cube rendering, timing, and scoring to the browser build
- [ ] Complete a full round (unfold mode)
- [ ] Dashboard charts render with the same data as a browser session against the same profile
- [ ] History list, session expansion, and Review all work
- [ ] Both Training lessons complete, including the practice questions
- [ ] Export produces a downloadable file; Import round-trips it

## Persistence

- [ ] Play a round, quit, relaunch: the session appears in History
- [ ] Replace the binary with a freshly built one (same version or a bumped version), relaunch: prior history is still present (automated by `crates/desktop/scripts/upgrade-sim.ps1` for the WebView2-profile-survives-a-swap mechanism; this row additionally confirms the SPA reads it back correctly)

## Failure modes

- [ ] (Windows only, if reproducible) Uninstall/rename the WebView2 Runtime, launch: a native dialog appears with a link to the Evergreen Bootstrapper, not a blank window
- [ ] Force-kill the webview render process (if your OS/tooling allows triggering this): a native reload-or-quit dialog appears rather than a frozen window

## Known v1 gaps (not failures -- tracked, not silently missing)

- No MSI/`.app`/AppImage installers yet -- portable zip/tar.gz only (spec DESK-05 AC1, partially met)
- No code signing or notarization (spec explicitly defers this)
- IPC bridge (`window.openfold`/`ping`) has no user-facing feature yet -- architecture insurance only (spec DESK-04)
