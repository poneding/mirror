# AGENTS.md

Guidance for agents working in this repository.

## What this project is

**Mirror** — a cross-platform, offline, high-performance video player built with
Rust (Tauri 2) and a React/TypeScript frontend. The product intent is a clean,
minimal, frosted-glass interface: "like a clean mirror". The window sizes itself
to the video's aspect ratio, IINA-style.

The interface language is Chinese by default, with an English option.

## Architecture

Two processes, one window:

```
src-tauri/                     Rust: native shell
  src/lib.rs                   Tauri commands + window setup (tested)
  src/main.rs                  Entry point, delegates to mirror_lib::run()
  tauri.conf.json              Window, bundle targets, updater endpoint + public key
  capabilities/default.json    Permissions (core, dialog, updater)

src/                           Frontend: WebView UI
  App.tsx                      React component: state, effects, layout
  lib/player.ts                Pure logic, no DOM/React/Tauri (unit tested)
  lib/player.test.ts           Unit tests for lib/player.ts
  lib/markdown.ts              Release notes → blocks for the update notice (unit tested)
  styles.css                   CSS variables + frosted surfaces

cliff.toml                     git-cliff config: the shape of the release notes
scripts/set-version.mjs        Writes the release tag's version into the four files that carry it
.github/workflows/release.yml  Builds, signs and publishes on a published release
```

The Rust layer only does what the WebView cannot: window sizing, pinning,
fullscreen, native file dialogs, and OS blur (Acrylic/Vibrancy via
`window-vibrancy`). Video decoding is delegated to the system WebView, so there
is no bundled decoder.

**Keep `lib/player.ts` free of React, DOM, and Tauri imports.** It must stay
pure and directly unit-testable. If logic needs a side effect, put the effect in
`App.tsx` and the decision in `lib/player.ts`. `lib/markdown.ts` follows the
same rule: it parses text, `App.tsx` renders the blocks it returns.

`fitWindowToVideo` in `src/lib/player.ts` and `fitted_size` in
`src-tauri/src/lib.rs` implement the same algorithm in two languages. **If you
change one, change the other.** Both have tests.

## Commands

Use the Makefile; run `make help` for the full list.

| Command | Purpose |
| --- | --- |
| `make check` | Typecheck + lint everything (CI gate, no writes) |
| `make lint` | ESLint + clippy (`-D warnings`) |
| `make test` | Vitest + `cargo test` |
| `make run` | Launch the desktop app (`tauri dev`) |
| `make run-web` | Frontend only in a browser (fast UI iteration) |
| `make build` | Frontend bundle |
| `make build-app` | Full desktop binary + installers |
| `make fmt` | `cargo fmt` |
| `make coverage` | Coverage for `src/lib` |
| `make audit` | `cargo audit` + `npm audit` |

Before finishing any change, run at least `make check` and `make test`.

### Makefile constraints

The Makefile targets the actual development environment, verified:

- **GNU Make 3.81** — no `.ONESHELL`, no `!=` assignment, no `.RECIPEPREFIX`
  tricks.
- The make shell is **Git Bash `sh`** — use POSIX syntax, not Bashisms.
- **Each recipe line runs in its own shell.** Combine steps with `&&` or `;`
  when they must share state, or split into separate lines that each stand alone.

## Conventions

**TypeScript**
- Strict mode; avoid `any`.
- Prefer small pure functions in `lib/player.ts` over inline logic in JSX.
- `eslint-plugin-react-hooks` is enabled and treated as a real signal. If an
  effect's dependency list looks wrong, fix the code — do not add
  `eslint-disable`.

**Rust**
- The Windows subsystem flag
  (`#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`) belongs in
  `src-tauri/src/main.rs`. `windows_subsystem` only reaches the linker for the
  crate being linked, and `mirror_lib` is compiled to an rlib/staticlib/cdylib
  with no link step for the executable, so the same attribute in `lib.rs` is
  inert: the released `mirror.exe` links as a console app and Windows opens a
  terminal window next to the player. That shipped in v0.1.0-alpha.1. Check it
  on the built artifact, not on the source — read the PE header's subsystem
  field (2 = GUI, 3 = console); `cargo test` runs in debug, so it proves
  nothing here.
- `clippy` runs with `-D warnings`; warnings fail the build.
- Validate inputs at the command boundary and return `Result<_, String>` for
  anything the frontend can invoke.
- Format with `cargo fmt` before finishing.

**Tauri permissions**
- `core:default` only grants *read-only* window access. Any window mutation
  called from the frontend (`minimize`, `maximize`, `unmaximize`,
  `toggle_maximize`, `close`, `start_dragging`, `set_size`, …) needs an explicit
  `core:window:allow-*` entry in `src-tauri/capabilities/default.json`.
- **The failure mode is silent.** These calls are wrapped in `.catch()` so a
  missing permission is swallowed at runtime. If a window button or the titlebar
  drag appears to do nothing, check the capability list first; the rejected
  promise names the exact permission to add.
- Adding a capability requires a Rust rebuild, not just a frontend reload.
- Window sizing that Mirror needs is done by its own Rust command
  (`resize_to_video`), so the JS `set_size` permission is intentionally absent.
- The update check and install need `updater:default` (already granted). The
  plugin reads `tauri.conf.json > plugins > updater` when the app starts, not
  when it builds, so a malformed block fails at launch rather than at compile
  time.

**CSS**
- Use the shadcn default (neutral) palette via CSS variables defined in
  `:root`. Do not hardcode hex values in components.
- Both light and dark themes must work; check `data-theme` selectors and the
  `prefers-color-scheme` block for `system`.
- `--background` is a translucent wash, not a page colour: the selected tab and
  the slider thumb's ring read it, so it stays translucent in every theme block.
  Keep the `system` block's dark values identical to `[data-theme="dark"]` — a
  value that lands in only one of them makes 深色 and 跟随系统 render
  differently.
- Icons come from `lucide-react` only. No emoji as UI icons.
- Scrollbars are styled through `::-webkit-scrollbar` only. Setting the standard
  `scrollbar-color` / `scrollbar-width` properties makes Chromium ignore those
  pseudo-elements outright and the native track frame comes back. Thumbs are
  transparent until the scroll container is hovered, so panels stay quiet. A
  native scrollbar reserves its width, which a 190px dropdown cannot spare, so
  everything that scrolls inside a `ScrollArea` — panels and the dropdown menus —
  scrolls on that component's overlay thumb instead.
- Keep frosted surfaces (`backdrop-filter`) on panels and overlays, never on the
  element that covers playing video: blurring the picture both looks muddy and
  costs frames.
- Every glass surface is one recipe — `--glass-blur` and `--glass-fill` in
  `:root`, resolved against the per-theme primitives (`--glass-strong`,
  `--glass-sheen-top`). Glass draws **no border and no drop shadow**: the
  `--glass-border`, `--glass-border-strong`, `--glass-sheen`, `--shadow` and
  `--shadow-chip` tokens were removed deliberately, so a panel, dropdown,
  dialog, toast, OSD, tooltip or bar that grows an outline or a shadow is a
  regression, not a polish. The only elevation left is `--shadow-thumb` (a
  slider thumb off its rail), `--shadow-logo` (the home logo) and
  `--press-inset` (a press landing on a filled control). `--glass-strong` is a
  film over a heavily blurred, saturated picture, not a paint: near-opaque
  values (it was `.9`) hide the blur and every panel, bar and overlay reads as
  flat white. Because that film is translucent, the muted ink is one zinc step
  stronger than the palette default (see the comment in `:root`) — secondary
  text sits on glass everywhere and has to stay legible over an unknown picture.
- A button that used to carry a border now says `border: 0` explicitly
  (`.combobox-trigger`, `.ghost-button`, `.update-button`); without it the UA
  border comes back and the control reads as a box.
- The shell chrome has no motion: the titlebar and the control bar appear and
  disappear instantly (no transition on them), and panels do not slide in — the
  `panel-in` / `panel-in-left` keyframes are gone. The feedback animations that
  remain are the OSD, the dropdowns, the dialog, the toast and the name tooltip.
- The settings panel has one row template and one rhythm. `.setting-row`,
  `.setting-label`, `.toggle-row`, `.shortcut-row` and `.about-row` all take
  the same template, and `.setting-section > * + *` owns the spacing between
  them; a setting that owns the control under it (the seek slider, the
  playback-mode list) is a block and takes a wider step. The five sections had
  drifted into five rhythms — 6, 8 and 16px, mixed inside 播放 — so a section
  that spaces or sizes its own rows is a regression, and
  `src/lib/settings-rows.test.ts` fails on one.
- The control bar's own glass lives on `.player-chrome::before`, not on the bar.
  An element with `backdrop-filter` is the backdrop root for its descendants, so
  a filter on the bar left the speed dropdown filtering an empty backdrop: the
  picture behind the menu stayed razor sharp and it read as cellophane. Do not
  move it back onto the element.

## Behaviour contracts

These are specified by the product requirements. Changing them is a product
decision, not an implementation detail.

**Keyboard shortcuts**

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Play / pause | `Space` | `Space` |
| Seek | `←` `→` | `←` `→` |
| Volume | `↑` `↓` | `↑` `↓` |
| Previous / next | `⌘ ←` `⌘ →` | `Alt ←` `Alt →` |
| Playback speed | `⌘ ↑` `⌘ ↓` | `Alt ↑` `Alt ↓` |
| Fullscreen | `Enter` | `Enter` |
| Open video | `⌘ O` | `Ctrl O` |
| Settings panel | `⌘ ,` | `Ctrl ,` |
| Playlist panel | `⌘ P` | `Ctrl P` |

Note the modifier split: on macOS track/speed use **cmd**, on Windows/Linux they
use **alt**. Panel shortcuts use **cmd**/**ctrl**. This is implemented in
`resolveShortcut` and covered by tests — do not "simplify" it to one modifier.

A plain arrow is a seek on a tap and a scan on a hold: `←` plays at 0.25x, `→` at
2x, and the chosen rate comes back on release. The scan starts only after
`HOLD_SPEED_DELAY_MS`, so the seek fires on key-up; the auto-repeat keydown
stream is dropped rather than re-seeking, which is why the gesture lives in
`advanceSeekHold` (`lib/player.ts`) and `App.tsx` only runs the timer and writes
`playbackRate`. A scan never touches `speed` or what it persists, and losing the
window ends it.

`Esc` precedence: update dialog → settings panel → playlist panel → exit
fullscreen.

Shortcuts must never fire while a text input, textarea, or select has focus
(`isTypingTarget`), with `Esc` as the only exception. A modal owns the keyboard:
while the update dialog is open every key but `Esc` is dropped, so `Space` cannot
toggle playback behind it.

The settings panel lists **only the bindings for the platform it is running on**
(`shortcutKeys` + `SHORTCUT_ORDER`), so the keys shown always match the keys that
work. Do not reintroduce a row per platform.

**Playback-end modes** (`playbackMode`): `pause` stops, `playlist` advances then
stops at the end, `single` repeats one item, `list` wraps forever. See
`resolveEndedAction`.

**Window sizing**: the window always matches the video aspect ratio. Scale is
applied uniformly; constraints change overall size, never a single axis.
Independent per-axis clamping distorts extreme ratios (32:9, tall portrait) —
this was a real bug, now covered by tests in both languages. If a ratio is too
extreme to satisfy both the minimums and maximums, the **maximums win** so the
window still fits on screen.

**The picture is never cropped.** `fitWindowToVideo` only sizes the window when
Mirror loads a file; it does not constrain later drags, and Tauri 2 / tao 0.35
expose no `set_aspect_ratio`, so the user can always make the window a different
shape from the video. The picture must then be letterboxed in full, never cut.
That makes the CSS load-bearing: `.video-element` needs `min-width: 0;
min-height: 0;` because a `<video>` is a replaced element and, as a grid item of
`.stage`, its automatic minimum size is its intrinsic size. Without those two
declarations `height: 100%` loses to the intrinsic height, the element overflows
the stage, and `.stage { overflow: hidden }` crops the top and bottom off. The
zero minimums are the fix, not a workaround — `object-fit: contain` can only
letterbox inside an element that is allowed to be smaller than the picture.
`src/lib/aspect.test.ts` reads `src/styles.css` and fails if either declaration
disappears, so this cannot regress silently. Padding the `resize_to_video`
command with chrome insets would **not** help: it offsets the space needed, it
does not stop the crop.

**The picture is fitted inside the window's client area, on whole CSS pixels.**
WebView2 rounds the page's viewport up to whole CSS pixels, so the page is about
a CSS pixel taller than the window's client area: a window fitted to a video at
175% shows 630.29 CSS px of client while the page lays out 631.43. Fitting and
centring inside the page therefore puts the surplus *above* the picture — a
visible gap at the top, measured as 2 device pixels of letterbox under the live
window — and pushes the picture's bottom edge past the window's. `App.tsx`
measures the client area (`innerSize()/scaleFactor()` on the native side,
`window.innerWidth/innerHeight` in the browser preview) and sizes `.stage` to
it, and `pictureOffset` (`lib/player.ts`) rounds the letterbox offsets to whole
CSS pixels. That rounding is load-bearing beyond looks: a *playing* video is
drawn by a different compositing pass depending on whether a frosted bar above
it needs the picture as a backdrop, and the two disagree about a fractional
offset — measured on a 175% display, the picture sat one device pixel lower
whenever the titlebar appeared and came back up when it left, while a paused
video did not move at all. Snapping to a whole *device* pixel does **not** work:
0.57 CSS px is still fractional in CSS terms. The picture moves by at most half
a CSS pixel, which is invisible, and the rounding never pushes it past the
client's edge.

**Window controls**: the window is undecorated (`decorations: false`), so the
minimise/maximise/close buttons are ours to draw. Windows/Linux get all three;
macOS keeps minimise + close. The glyph follows the real window state, synced
through `onResized` so it stays correct when the window is maximised by another
route (double-click, OS shortcut).

**macOS traffic lights**: macOS is the one platform where the window is not
undecorated — `tauri.macos.conf.json` sets `titleBarStyle: "Overlay"` with
`hiddenTitle` and `decorations: true`, which keeps the system's three window
buttons painted *over* Mirror's own titlebar. They are placed by
`trafficLightPosition` (the config field Tauri wants for exactly this style) and
faded by `set_traffic_lights_visible` (`lib.rs`), because the stylesheet can
neither move the dots into the bar nor take them away with it. Both numbers are
kept in step with the stylesheet by a test. The position is `--titlebar-height /
2 - 2`: macOS centres the stock buttons 14pt down its own 28pt titlebar (their
frame is `(7, 6, 14, 16)` in a 28pt view), and tao's inset puts that centre at
`inset + 2` — measured on the live window, not derived. Left at the stock height
the dots read as "a bit high" in a 36px bar, because they are. The fade runs on
`--dur-slow` (`TITLEBAR_FADE_SECONDS` in `lib.rs`), so the dots ease out instead
of blinking; the bar itself is instant now, which makes the dots the one part of
the titlebar that animates. Two details are
load-bearing. A hidden button is *hidden*, not transparent: a click at zero
alpha still lands, and the pointer can be parked on one when the titlebar times
out, so `alphaValue` alone would turn a stray click at the top-left into a
closed window. And a fade that is overtaken — the pointer comes back mid-slide —
must not hide the buttons on its way out, which is what the
`TRAFFIC_LIGHTS_VISIBLE` flag is read for. Fullscreen is the one place Mirror
keeps its hands off, because the system owns the titlebar there: a request that
arrives while the window is fullscreen is dropped, and the frontend re-states
the truth on the way out of Mirror's own toggle — a window taken fullscreen by
the system shortcut (⌃⌘F) instead settles on the next pointer-driven change.
Everywhere but macOS the command is a no-op.

**macOS draws a white edge around the window, and two settings keep it away.**
The window's edge highlight is part of its shadow and is painted *above* the
page — a black shell does not cover it — so it shows wherever the picture is
dark, which is exactly the state Mirror is in once the chrome has hidden
itself: `Esc` leaves the bars away with the pointer outside the window, so the
border is what the user sees. Measured over a black picture it was one device
pixel of white at about 10% alpha down the left, right and bottom edges, and two
brighter pixels across the top. `set_shadow(false)` in the macOS `apply_glass`
(`lib.rs`) removes the three sides; the top pair is the transparent titlebar's
own highlight, and `macOSPrivateApi` in `tauri.conf.json` is what puts it under
the page (the `macos-private-api` feature in `Cargo.toml` must be on for the
config to take effect — `tauri dev` adds it, and the build warns without it).
Both fail quietly if reverted, so `lib/window-edge.test.ts` reads the config and
`lib.rs` and fails on either. The cost is the window's drop shadow on macOS: a
window that is its own canvas has no need of the OS one, and the rounded corners
survive.

**Fullscreen from a maximized window** needs a Windows-only detour in
`set_window_fullscreen` (`lib.rs`), and both halves of it are load-bearing. Win32
ignores `SetWindowPos` geometry while a window carries `WS_MAXIMIZE`, and tao
0.35 through 0.37 leave that bit set when they switch a window to borderless
fullscreen (tao#1087; the fix, #1088, is unmerged), so the fullscreen geometry
landed on the restore rect: the window kept the work-area size, taskbar and all,
while the transport hid as if the picture had grown. Entering fullscreen
therefore drops the maximize and re-applies the monitor geometry; leaving it
maximizes first, because tao restores its own saved placement by putting the
normal rect back before maximizing, which is one visible frame of a small window
otherwise. Both intermediate states are real but are never presented: measured
over CDP with `Page.startScreencast` on the live window, the only frames the
compositor shows are the maximized and the fullscreen one. A window that was
never maximized takes the untouched path, and the whole detour can go when tao
fixes this.

**Control bar layout**: volume on the left, transport (previous / play / next)
truly centred, playback speed and fullscreen on the right. The centring uses a
`1fr auto 1fr` grid, so the transport stays centred regardless of how wide the
side groups get — do not replace it with `justify-content: space-between`.
Seeking lives on the arrow keys and the progress bar, not on dedicated buttons.
The play/pause button is a circle.

**An open panel takes the window over from the control bar, never from the
titlebar.** Settings and the playlist hide the transport bar
(`.panel-open .player-chrome`) — the backdrop already sat over it, so nothing was
clickable there — while the titlebar stays: `chromeShown` in `App.tsx` keeps the
shell out of `chrome-hidden` whenever a panel is open. Without that, the pointer
leaving the window slid the titlebar away and pulled the panel's top offset up
with it.

**The video picture is not a control.** Clicking it must not toggle playback;
resuming is the play button, `Space`, or the media keys.
`cursor: pointer` on `.video-element` would advertise otherwise — keep it
`default`.

**Autoplay**: a video restored from storage loads paused — opening Mirror is not
a request to play, so the user starts it. Adding a file, picking a playlist or
history row, or moving to another track still plays that item. `resolveAutoplay`
(`lib/player.ts`) owns this rule.

**Opening files and folders**: one control carries both ways in, split in two — the
label half opens video files straight away (one or many, through the platform
picker), the caret half opens a small menu with 打开视频 / 打开文件夹. The playlist
toolbar spells the same thing out as two plain buttons (添加视频 / 添加视频文件夹),
because there it has the room to. The split is a concession to the platform: a
native picker is either a file chooser or a folder chooser. Windows toggles
between them with `FOS_PICKFOLDERS` (*"folders rather than files"*), rfd
hard-wires the two macOS modes on `NSOpenPanel`, and the plugin exposes only
`directory: true/false`, so no one dialog can offer both and upstream still has
this open (tauri-apps/plugins-workspace#2137, PolyMeilex/rfd#131). Do not collapse
the home control back to a single hit area without replacing it with those two
buttons: opening a folder would then charge the common case a click. The label
half is also what closes an open menu before the picker takes the screen.

A folder brings every video under it: the folder's own files first, then its
subdirectories, both name-sorted case-insensitively. A dropped selection goes
through the same path, so dropping a folder loads it too. Only the native side can
enumerate a directory, so `collect_video_paths` (`lib.rs`) does that and is handed
`SUPPORTED_VIDEO_EXTENSIONS` — the extension list stays in `lib/player.ts` and is
not written down a second time in Rust. A file the user picked is added even
without an extension — the media element decides what it can decode — while a file
the walk finds must carry a listed one. Unreadable entries are skipped, and a
directory reached through a symlink is not walked: a link back to a parent would
loop forever. The browser preview has no such walk; it uses the file input's
`webkitdirectory` mode instead.

The menu owns its keys the way the dropdown does: it stops propagation so `Space`
and `Enter` cannot also reach the player (the halves are real buttons, so their
native activation would otherwise fire on top of a shortcut) and `Esc` closes the
menu before the shell sees it.

The drag-and-drop listener must be disposed through its own subscription promise
rather than a captured `let`: subscribing is asynchronous, and under StrictMode the
cleanup can run before it resolves, which left the first listener behind and made
every drop arrive twice in development.

**Settings panel**: a rail on the left switches between the five sections
(外观 / 播放 / 更新 / 快捷键 / 关于); the body shows the selected one alone, so
reaching 关于 no longer means scrolling past the other four. Section icons are
plain glyphs with no badge behind them. The update check button sits on the
section title row (via the `action` slot of `SettingSection`); the auto-check
preference, the preview-build preference and a 查看详情 button in the body.
Playback speed, theme, and language are dropdowns; so are the two font
choices (界面字体 / 等宽字体), whose lists are the system's installed fonts
enumerated by the `list_system_fonts` command and cached for the process —
every option previews in its own face. The release notes are not
rendered here — they belong to the update dialog, below.

**Update dialog**: the result of a check is a modal, not a paragraph in the
panel. A check the user asked for always reports — up to date, a withheld
preview, or an error — while the check on launch opens the dialog only when
there is an update the user can act on, so it never nags. The release notes are
the point of it, rendered from `lib/markdown.ts` blocks like everywhere else. It
is modal: `resolveEscape` closes it before the panels, the global shortcut
listener drops every key but `Esc`, `Tab` is trapped inside, and focus returns to
whatever opened it. It holds no state of its own — `App.tsx` owns the update
state and passes it in.

**Preview builds are opt-in**: `acceptsUpdate` (`lib/player.ts`) withholds any
release whose version carries a SemVer prerelease part (`0.1.0-alpha.2`) unless
接收预览版更新 is on, so the updater never moves a stable install onto an alpha.
A withheld preview is *reported* rather than hidden: the dialog names the version
and offers to turn the preference on and re-check, because otherwise it looks
identical to being up to date. This reads the version string, not GitHub's
prerelease flag — see the release section for that one.

**Combobox** (`Combobox` in `App.tsx`): a listbox-style dropdown used for the
speed, theme, and language choices. Three rules matter:

- The trigger keeps focus and the active option is tracked with
  `aria-activedescendant`; options are never focusable. This keeps `Tab` order
  short and avoids focus juggling.
- **Keys it handles must `stopPropagation`**, because the global shortcut
  listener sits on `window`: without it, `Space` would also toggle playback and
  the arrows would also change the volume.
- `Esc` closes the open list without closing the panel, which is why it stops
  propagation only while `open`.

**Playback rate** is a fixed ladder (`SPEED_STEPS`). Values are snapped with
`snapSpeed` on load so a legacy or hand-edited stored rate always has a matching
entry to display.

**Status indicator (OSD)**: play/pause, volume and playback-rate changes briefly
show a frosted pill near the top of the interface, for `OSD_DURATION_MS`.
Deliberate constraints:

- It is a sibling of the auto-hiding chrome, not a child, so feedback stays
  visible while the titlebar and control bar are hidden.
- It must only fire from user-initiated actions with a *known new value*.
  Firing it from an effect (for example when `volume` changes) would also fire on
  load and on every unrelated re-render.
- Actions without a visible value change (fullscreen) do not announce.
- A shortcut never wakes the hidden chrome. `Space`, the media keys, volume and
  speed answer with the pill alone, and the pointer is the only thing that
  brings the titlebar and the control bar back: no effect may reveal the chrome
  off `isPlaying` (keying one on it — or on a `showChrome` whose identity
  changes with it — also fires on every keyboard play/pause), and closing a
  panel must not reveal it either. `Esc` and the panel shortcut are pressed with
  the pointer asleep or outside the window, so a panel that closes without the
  pointer leaves the bars hidden; one closed *with* the pointer — a backdrop or
  header-button click — reveals them through the `showChrome` that click already
  ran. While a panel is open the titlebar stays up through `chromeShown`, so the
  window stays draggable and closable.
- The bars hide on a clock rather than on playback state: `CHROME_HIDE_DELAY_MS`
  after the last pointer movement — paused as well as playing — and at once when
  the pointer leaves the window. A picture arriving and a panel closing arm that
  clock; the home screen, with nothing on the stage, keeps its bars. `isPlaying`
  must not arm it either: a paused picture is not a reason to keep them.

## Release and updates

A pushed version tag is the trigger, and the workflow creates the release
itself, so a release is `git tag v1.2.3 && git push origin v1.2.3`. Publishing a
release by hand runs the same pipeline for its tag — that is how a tag pushed
before this trigger existed, or a failed run, still gets released. The tag push
reads the workflow from the tagged commit, so a tag pointing at an older commit
needs that manual step; pushes to `main` publish nothing.

1. Tag `v1.2.3` (SemVer; `v1.2.3-rc.1` for a prerelease) and push it.
2. `.github/workflows/release.yml` rejects non-SemVer tags, stamps the version
   into `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json` and
   `src-tauri/Cargo.toml`, creates the release, writes the git-cliff changelog
   into its body, then builds and signs every desktop target and uploads the
   bundles plus `latest.json`.
3. That body *is* the changelog the app shows: `latest.json` carries it as
   `notes`, and the update notice renders it through `lib/markdown.ts` as
   elements — release notes are remote text, so they are never injected as HTML.

Four things must stay in step or updates break, and none of them fail at build
or test time:

- The tag is the single source of truth for the version. Editing a version
  literal by hand makes `tauri.conf.json`, `Cargo.toml` and the tag drift; use
  `node scripts/set-version.mjs v1.2.3`.
- `plugins > updater > pubkey` must be the public half of the private key in the
  `TAURI_SIGNING_PRIVATE_KEY` repository secret. The bundler only *warns* on a
  mismatch; the app then refuses the update forever.
- `plugins > updater > endpoints` must point at this repository's
  `releases/latest/download/latest.json`.
- The release that endpoint resolves to must **not** carry GitHub's *prerelease*
  flag while the project has no stable release. `/releases/latest` skips drafts
  and prereleases, and the API refuses `make_latest` on one ("Latest release
  cannot be draft or prerelease"), so with prerelease-only releases the URL
  returns 404 and the app reports "Could not fetch a valid release JSON from the
  remote" — `tauri-plugin-updater` maps the failed JSON decode to that message.
  A SemVer prerelease *tag* (`v0.1.0-alpha.2`) is fine; it is the GitHub flag
  that hides the release. The workflow enforces this itself, on create and on
  update: a prerelease *tag* is flagged only once a stable tag already has a
  release, which keeps `/releases/latest` serving a real `latest.json` either
  way. `gh release edit <tag> --prerelease=false` is the same fix by hand.
  Once a stable release exists, flagging prereleases is correct:
  `/releases/latest` is then the stable and a prerelease install still upgrades
  to it, because `0.1.0` is greater than `0.1.0-alpha.3` in SemVer.

Commit subjects drive the changelog, so keep them Conventional
(`feat`/`fix`/`perf`/`refactor`/`docs`); `cliff.toml` filters out
`chore`, `ci`, `style` and `test`.

## Persistence

All settings live in `localStorage` under the keys in `STORAGE_KEYS`
(`lib/player.ts`) — use those constants, never string literals.

Two rules matter:

1. **A missing key must return its default.** `Number(null)` is `0`, so reading
   a number with `Number(store.getItem(key))` silently forces the minimum. This
   was a real bug (volume defaulted to 0). Use `getInitialNumber`.
2. **`blob:` sources cannot survive a reload.** The browser preview uses blob
   URLs; the packaged app uses `asset://` URLs which persist. `parseStoredPlaylist`
   drops blob entries so a restart never shows dead rows. Verified by tests.

## Verification expectations

- New logic in `lib/player.ts` needs unit tests. The suite is mutation-tested:
  it catches off-by-one wrap, wrong modifiers, bad clamps, and broken aspect
  ratios. A test that cannot fail is not useful.
- For UI or playback changes, verify against a **real video file** in a browser
  (`make run-web` — drag a file onto the window) since jsdom cannot decode video.
- For window/native changes, verify in the actual Tauri window, not just the
  browser preview. The browser fallback path differs from the native path.

To drive the real Tauri window for verification, enable WebView2 remote
debugging in `src-tauri/tauri.conf.json`:

```json
"app": { "windows": [ { "additionalBrowserArgs":
  "--remote-debugging-port=9222 --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection" } ] }
```

WebView2 ignores the `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` environment
variable here because `wry` 0.55 sets `ICoreWebView2EnvironmentOptions`
`AdditionalBrowserArguments` in code; when that property is set it wins and the
environment variable is dropped. Passing the args through the config is the only
reliable route, and it needs a Rust rebuild. `wry` also replaces the default
args when this is set, so keep the three `--disable-features` values above.
**Revert the entry after verifying** — a shipped build must not open a debugging
port.

Then attach over CDP at `http://127.0.0.1:9222` (Playwright's
`chromium.connectOverCDP`, or `curl http://127.0.0.1:9222/json` to list pages).
Under `tauri dev` the page URL is `http://localhost:6477/`; a production build
serves `http://tauri.localhost/`. Check the URL either way, so you know you
reached the native webview and not a browser tab.

Resizing a live window: `Browser.getWindowForTarget` + `Browser.setWindowBounds`
changes the real window size for real, and `Page.captureScreenshot` shows what
the user actually sees — enough to measure picture coverage and to see cropping
in the pixels. This is how the "adjusting the width crops the picture" bug was
diagnosed and confirmed fixed; do not accept a layout claim that was only
reasoned about.

Generate test media with ffmpeg:

```sh
ffmpeg -y -f lavfi -i "testsrc=size=1920x1080:rate=30:duration=6" \
  -f lavfi -i "sine=frequency=440:duration=6" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest sample-1080p.mp4
```

Useful shapes: `1920x1080`, `1280x720`, `720x1280`, `2560x1080`. A solid-colour
clip (`-f lavfi -i "color=c=0x008000:size=1920x1080"`) makes letterboxing and
frame coverage obvious.

Clean up scratch directories when done; `.tmp-*` and `tmp-*` are git-ignored and
excluded from lint.

## Application logo

`src/assets/logo.svg` is the editable vector master; its neutral palette lives
in the SVG CSS variables. Run `make icons` after changing it. This uses the
installed Tauri CLI to regenerate `src/assets/logo.png`, the 1024×1024
`src-tauri/icons/icon.png`, and all desktop PNG/ICO/ICNS sizes without adding
a dependency. Do not hand-edit the generated bitmaps or upscale a small PNG.

## Known limitations

Do not present these as finished:

- Nothing is code-signed: there is no Apple Developer ID or Windows
  Authenticode certificate, so the OS warns on first launch. CI produces a
  Windows NSIS installer, a Linux AppImage and `.deb`, and macOS `.app` + `.dmg`
  (arm64 and x86_64); MSI and `.rpm` are not built.
- Update checks only find releases published through the workflow (they need
  `latest.json`); a wrong repository in `endpoints` shows up as a failed check in
  the settings panel.
- Playback depends on system WebView codecs. Some `mkv` encodes will not play
  where the OS lacks the codec — this is expected, not a bug to chase.
- The playlist is flat with no reordering and no persisted playback position per
  item beyond the single most recent entry.
- Panels occupy one shared slot, so settings and playlist are mutually
  exclusive. The `Esc` ordering between them is therefore not independently
  observable in practice.

## Do not

- Do not add a bundled video decoder or FFmpeg dependency without discussion;
  delegating to the system WebView is a deliberate tradeoff.
- Do not add networking, telemetry, or analytics. The product is explicitly
  offline-first: "nothing leaves your device". The one request Mirror makes is
  the update check, which asks this project's own GitHub release for
  `latest.json` and only runs while the user leaves "check for updates" on. Keep
  it that way: nothing about the user or their media may ever be sent.
- Do not hardcode colours outside the CSS variable set.
- Do not suppress lint warnings to make a gate pass; fix the cause.