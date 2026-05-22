# wf-map-corp

Standalone corporate-skin workflow map — extracted from [prototypes](../prototypes) (`workflow-intro` corporate view only).

## Contents

| Path | Description |
| ---- | ----------- |
| `workflow-intro/` | Main experience (module path, volumes, leaderboard, activity log) |
| `css/` | Theme, workflow intro, corporate skin, module modal, cheat panel |
| `js/` | App logic, progress, cords, sounds, ambient office music |
| `assets/` | Corporate hero imagery, UI sounds (`.ogg`), `office ambient.mp3`, ambient loop `p1.mov`–`p5.mov` |

Space skin, flow-map launcher, and space ambient playlist (`.mov`) are not included.

## Local preview

From this folder:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080 (redirects to `workflow-intro/`).

Cheat panel: **Shift + C** — corporate appearance, module layout, music, hover sounds, progress cheats.
