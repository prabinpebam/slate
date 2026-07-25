# Slate Visualization

Slate routes structured content to the visual medium that explains it best. This folder is part of
the portable Slate package and contains the authoring skills for charts, graphs, infographics,
icons, narrative visuals, and custom SVG illustration.

## Native routes

| Need | Skill | Output |
| --- | --- | --- |
| Bespoke explanatory diagram, editorial illustration, spatial model, object/scene, icon, map, pattern, or motion subject | [`svg-illustration`](skills/svg-illustration/SKILL.md) | Validated SVG, optionally enhanced by Slate viewport or presentation motion |
| Standard chart or quick quantitative figure | [`chart-visualization`](skills/chart-visualization/SKILL.md) | Exported local chart image |
| Rich statistical chart and custom scales/marks | [`antv-g2-chart`](skills/antv-g2-chart/SKILL.md) | Exported SVG/PNG |
| Network or graph auto-layout | [`antv-g6-graph`](skills/antv-g6-graph/SKILL.md) | Exported SVG/PNG |
| Node-edge editor or architecture auto-layout | [`antv-x6-editor`](skills/antv-x6-editor/SKILL.md) | Exported SVG/PNG |
| Pivot table or spreadsheet visualization | [`antv-s2-expert`](skills/antv-s2-expert/SKILL.md) | Exported image/table |
| Insight-dense narrative | [`narrative-text-visualization`](skills/narrative-text-visualization/SKILL.md) | Narrative visual asset |
| Summary poster | [`infographic-creator`](skills/infographic-creator/SKILL.md) | Infographic asset |
| Supporting icon | [`icon-retrieval`](skills/icon-retrieval/SKILL.md) | Local icon asset |

## Routing rule

Choose the medium before authoring:

- Use **SVG Illustration** when exact composition, semantic geometry, accessibility, theming, or
  stable motion subjects are the hard part.
- Use a **chart or graph engine** when scales, data transforms, interaction, or automatic layout are
  the hard part.
- Use **Slate HTML components** for text-heavy responsive UI, tables, cards, and document structure.
- Use **bitmap imagery** for photorealism, painterly texture, or complex natural detail.
- Use **Canvas/WebGL/Three.js** for simulation, 3D, or thousands of changing marks.

Do not turn every process into boxes, every number into an infographic, or every presentation slide
into decorative SVG. The chosen visual must materially improve comprehension.

## Slate embedding boundary

Slate content is static and sanitized. Visuals are either:

1. safe inline SVG using presentation attributes;
2. local exported SVG/PNG through the figure component; or
3. an inline SVG with semantic steps animated on viewport entry by Slate's trusted article runtime; or
4. an inline SVG with stable IDs animated by Slate's presentation motion manifest.

No content-owned script, style block, event handler, remote resource, iframe, or autonomous SVG
animation is allowed. Slate owns viewport detection, replay controls, reduced motion, and deck state.
Every authored content SVG uses that host layer: it starts when it enters the viewport in reading
mode, exposes replay only while the SVG is hovered or keyboard-focused, and delegates to the current
slide restart action in presenter mode. Static SVG remains the fallback/export state, not the live
Slate illustration behavior.
See the complete
[SVG Illustration production profiles](skills/svg-illustration/SKILL.md#slate-production-profiles).

## Validation

Run the focused native SVG checks from a repository containing Slate:

```powershell
npm run validate:svg-illustration --prefix .\slate
npm run test:svg-illustration --prefix .\slate
```

Render inspection in the actual host remains mandatory; structural validation is not proof of visual
quality.

## AntV attribution and license

The AntV skills under this folder are an English derivative of
[`antvis/chart-visualization-skills`](https://github.com/antvis/chart-visualization-skills),
Copyright 2025 AntV Visualization Team, under the MIT License. See [`LICENSE`](LICENSE) and
[`NOTICE`](NOTICE). The Slate SVG Illustration bundle is a separate Slate-native capability adapted
from the complete local source bundle supplied by the user.
