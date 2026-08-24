# Placeholder icon assets

Every icon file in this directory is a **placeholder**, derived from the
monogram spec in `design/geoquest-design-system-v1.html` (Jungle ink
`#10262B` field, Explorer teal `#0EA5A0` capital "G", Sunset coral `#FF7A59`
map-pin accent dot).

## Swap procedure

Replacing the final brand asset requires **no** `manifest`, `index.html`, or
source code change: just overwrite the file bytes at the **same filename and
pixel dimensions** listed below, then rebuild.

| File                       | Size    | Purpose                                                                               |
| -------------------------- | ------- | ------------------------------------------------------------------------------------- |
| `favicon.svg`              | vector  | Browser tab icon (`index.html`)                                                       |
| `icon-192.png`             | 192x192 | Web App Manifest icon, `purpose: any`                                                 |
| `icon-512.png`             | 512x512 | Web App Manifest icon, `purpose: any`                                                 |
| `icon-512-maskable.png`    | 512x512 | Web App Manifest icon, `purpose: maskable` (glyph must stay inside the 80% safe zone) |
| `apple-touch-icon.png`     | 180x180 | iOS home-screen icon (`index.html`)                                                   |
| `icon-source.svg`          | 512x512 | Hand-authored source for the non-maskable rasters above                               |
| `icon-source-maskable.svg` | 512x512 | Hand-authored source scaled to the maskable safe zone                                 |

## Regeneration commands

The four PNG rasters were generated once from the two source SVGs with
[`sharp-cli`](https://github.com/lovell/sharp-cli), run from the repo root:

```sh
npx --yes sharp-cli -i public/icon-source.svg -o public/icon-192.png resize 192 192
npx --yes sharp-cli -i public/icon-source.svg -o public/icon-512.png resize 512 512
npx --yes sharp-cli -i public/icon-source-maskable.svg -o public/icon-512-maskable.png resize 512 512
npx --yes sharp-cli -i public/icon-source.svg -o public/apple-touch-icon.png resize 180 180
```

`sharp-cli` is not a project dependency — `npx --yes` fetches it on demand for
this one-off authoring step and is not part of the build or CI pipeline.
