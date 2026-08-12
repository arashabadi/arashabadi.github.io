# Spatial transition data

`spatial-demo.json` contains deterministic synthetic observations for the homepage prototype. The browser uses the two-dimensional spatial endpoint as the base for an abstract, layered cell volume; it is illustrative and is not an experimental result.

Each observation requires these fields:

| Field | Description |
|---|---|
| `id` | Stable, unique observation identifier |
| `cellType` | Key used for color and filtering |
| `color` | Optional CSS color; the demo palette is defined in `metadata.cellTypes` |
| `umapX`, `umapY` | UMAP coordinates normalized to `[0, 1]` |
| `spatialX`, `spatialY` | Physical spatial coordinates normalized to `[0, 1]` |

The browser uses a top-left origin with positive `y` pointing down. When exporting from R or Python, normalize both coordinate systems independently and invert `spatialY` before export when the source uses a bottom-left origin.

The same rows must represent the same observations in both coordinate systems. Do not combine unrelated scRNA-seq and spatial observations without an explicit mapping model.

Regenerate the demonstration file with:

```bash
node scripts/generate-spatial-demo.mjs
```
