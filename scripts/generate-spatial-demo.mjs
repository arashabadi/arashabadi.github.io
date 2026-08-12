import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = 20260812;
const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../assets/data/spatial-demo.json'
);

const cellTypes = [
  { key: 'b_cell', label: 'B cell', count: 300, color: '#63b7e8', umap: [0.25, 0.33, 0.07, 0.1] },
  { key: 'cd4_t', label: 'CD4 T cell', count: 190, color: '#9a98c8', umap: [0.52, 0.18, 0.09, 0.052] },
  { key: 'cd8_t', label: 'CD8 T cell', count: 150, color: '#7488ad', umap: [0.77, 0.5, 0.065, 0.11] },
  { key: 'treg', label: 'Treg', count: 120, color: '#65c9b5', umap: [0.67, 0.27, 0.065, 0.075] },
  { key: 'macrophage', label: 'Macrophage', count: 180, color: '#ca8067', umap: [0.29, 0.72, 0.1, 0.073] },
  { key: 'dendritic', label: 'Dendritic cell', count: 90, color: '#d8b568', umap: [0.48, 0.59, 0.055, 0.068] },
  { key: 'stromal', label: 'Stromal cell', count: 140, color: '#a58f7b', umap: [0.61, 0.76, 0.11, 0.052] },
  { key: 'epithelial', label: 'Airway epithelial cell', count: 150, color: '#d8aaa0', umap: [0.13, 0.59, 0.05, 0.1] }
];

const airway = { cx: 0.28, cy: 0.51, rx: 0.115, ry: 0.205, rotation: -0.08 };
const ibalt = {
  cx: 0.66,
  cy: 0.49,
  rx: 0.215,
  ry: 0.29,
  rotation: -0.12,
  follicle: { cx: 0.68, cy: 0.39, rx: 0.12, ry: 0.135, rotation: -0.08 },
  tZone: { cx: 0.61, cy: 0.61, rx: 0.125, ry: 0.105, rotation: 0.2 },
  interface: { cx: 0.6, cy: 0.48, rx: 0.075, ry: 0.09, rotation: 0 }
};

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

const random = mulberry32(SEED);

function gaussian() {
  const u = Math.max(random(), Number.EPSILON);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function clamp(value, minimum = 0.035, maximum = 0.965) {
  return Math.max(minimum, Math.min(maximum, value));
}

function ellipseDistance(x, y, ellipse) {
  const cosine = Math.cos(-ellipse.rotation);
  const sine = Math.sin(-ellipse.rotation);
  const dx = x - ellipse.cx;
  const dy = y - ellipse.cy;
  const localX = dx * cosine - dy * sine;
  const localY = dx * sine + dy * cosine;
  return Math.sqrt((localX / ellipse.rx) ** 2 + (localY / ellipse.ry) ** 2);
}

function inAirwayLumen(x, y, padding = 1) {
  return ellipseDistance(x, y, airway) < padding;
}

function inIbalt(x, y, padding = 1) {
  return ellipseDistance(x, y, ibalt) < padding;
}

function validTissuePoint(x, y) {
  return x > 0.04 && x < 0.96 && y > 0.08 && y < 0.92 && !inAirwayLumen(x, y, 0.92);
}

function sampleParenchyma({ avoidIbalt = false } = {}) {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const x = 0.05 + random() * 0.9;
    const y = 0.1 + random() * 0.8;
    if (validTissuePoint(x, y) && (!avoidIbalt || !inIbalt(x, y, 1.05))) return [x, y];
  }
  throw new Error('Unable to sample a point in the lung section.');
}

function sampleEllipse(ellipse, spread = 0.42) {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const localX = gaussian() * ellipse.rx * spread;
    const localY = gaussian() * ellipse.ry * spread;
    const cosine = Math.cos(ellipse.rotation);
    const sine = Math.sin(ellipse.rotation);
    const x = ellipse.cx + localX * cosine - localY * sine;
    const y = ellipse.cy + localX * sine + localY * cosine;
    if (validTissuePoint(x, y)) return [x, y];
  }
  return sampleParenchyma();
}

function sampleAirwayRing(radius = 1.12, jitter = 0.035) {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const radial = radius + gaussian() * jitter;
    const localX = Math.cos(angle) * airway.rx * radial;
    const localY = Math.sin(angle) * airway.ry * radial;
    const cosine = Math.cos(airway.rotation);
    const sine = Math.sin(airway.rotation);
    const x = airway.cx + localX * cosine - localY * sine;
    const y = airway.cy + localX * sine + localY * cosine;
    if (validTissuePoint(x, y)) return [x, y];
  }
  return sampleParenchyma({ avoidIbalt: true });
}

function sampleIbaltShell() {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const radial = 0.76 + random() * 0.28;
    const localX = Math.cos(angle) * ibalt.rx * radial;
    const localY = Math.sin(angle) * ibalt.ry * radial;
    const cosine = Math.cos(ibalt.rotation);
    const sine = Math.sin(ibalt.rotation);
    const x = ibalt.cx + localX * cosine - localY * sine;
    const y = ibalt.cy + localX * sine + localY * cosine;
    if (validTissuePoint(x, y)) return [x, y];
  }
  return sampleParenchyma();
}

function sampleSpatial(type) {
  const choice = random();
  if (type === 'epithelial') return sampleAirwayRing(1.08, 0.026);
  if (type === 'b_cell') {
    if (choice < 0.9) return sampleEllipse(ibalt.follicle, 0.46);
    return sampleParenchyma({ avoidIbalt: true });
  }
  if (type === 'cd4_t') {
    if (choice < 0.76) return sampleEllipse(ibalt.tZone, 0.5);
    if (choice < 0.9) return sampleIbaltShell();
  }
  if (type === 'treg') {
    if (choice < 0.68) return sampleEllipse(ibalt.tZone, 0.46);
    if (choice < 0.9) return sampleIbaltShell();
  }
  if (type === 'cd8_t') {
    if (choice < 0.4) return sampleEllipse(ibalt.tZone, 0.58);
    if (choice < 0.55) return sampleIbaltShell();
  }
  if (type === 'dendritic') {
    if (choice < 0.7) return sampleEllipse(ibalt.interface, 0.58);
    if (choice < 0.86) return sampleAirwayRing(1.35, 0.12);
  }
  if (type === 'macrophage') {
    if (choice < 0.42) return sampleAirwayRing(1.62, 0.25);
    return sampleParenchyma({ avoidIbalt: true });
  }
  if (type === 'stromal') {
    if (choice < 0.7) return sampleIbaltShell();
    if (choice < 0.84) return sampleAirwayRing(1.42, 0.11);
  }
  return sampleParenchyma({ avoidIbalt: type === 'macrophage' });
}

function sampleUmap(type, index) {
  let [cx, cy, sx, sy] = type.umap;
  if (type.key === 'b_cell' && index % 5 === 0) {
    cx += 0.09;
    cy += 0.045;
    sx *= 0.6;
    sy *= 0.65;
  }
  if (type.key === 'macrophage' && index % 4 === 0) {
    cx -= 0.07;
    cy -= 0.045;
  }
  const angle = (cellTypes.indexOf(type) * 0.41) - 0.55;
  const rawX = gaussian() * sx;
  const rawY = gaussian() * sy;
  const x = cx + rawX * Math.cos(angle) - rawY * Math.sin(angle);
  const y = cy + rawX * Math.sin(angle) + rawY * Math.cos(angle);
  return [clamp(x), clamp(y)];
}

function buildAlveoli() {
  const alveoli = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const x = 0.075 + column * 0.125 + (random() - 0.5) * 0.035;
      const y = 0.14 + row * 0.18 + (random() - 0.5) * 0.04;
      if (ellipseDistance(x, y, airway) < 1.65 || inIbalt(x, y, 1.13)) continue;
      alveoli.push({
        cx: Number(x.toFixed(4)),
        cy: Number(y.toFixed(4)),
        rx: Number((0.045 + random() * 0.025).toFixed(4)),
        ry: Number((0.055 + random() * 0.03).toFixed(4)),
        rotation: Number(((random() - 0.5) * 0.7).toFixed(4))
      });
    }
  }
  return alveoli;
}

const cells = [];
let cellIndex = 0;
for (const type of cellTypes) {
  for (let index = 0; index < type.count; index += 1) {
    const [umapX, umapY] = sampleUmap(type, index);
    const [spatialX, spatialY] = sampleSpatial(type.key);
    cells.push({
      id: `cell_${String(cellIndex + 1).padStart(4, '0')}`,
      cellType: type.key,
      color: type.color,
      umapX: Number(umapX.toFixed(4)),
      umapY: Number(umapY.toFixed(4)),
      spatialX: Number(spatialX.toFixed(4)),
      spatialY: Number(spatialY.toFixed(4))
    });
    cellIndex += 1;
  }
}

const output = {
  metadata: {
    title: 'Deterministic illustrative UMAP-to-lung-iBALT mapping',
    scientificStatus: 'Synthetic demonstration data; not an experimental result.',
    seed: SEED,
    coordinateRange: [0, 1],
    requiredColumns: ['id', 'cellType', 'umapX', 'umapY', 'spatialX', 'spatialY'],
    cellTypes: cellTypes.map(({ key, label, count, color }) => ({ key, label, count, color })),
    tissue: { airway, ibalt, alveoli: buildAlveoli() }
  },
  cells
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
console.log(`Wrote ${cells.length} cells to ${outputPath}`);
