// Genera las variantes WebP del slider del hero a partir de los originales
// JPEG de assets-src/hero/.
//
//   node scripts/build-hero-images.mjs
//   node scripts/build-hero-images.mjs --src <dir> --out <dir>
//
// Los overrides existen para poder ensayar el recorte contra otra carpeta sin
// escribir en public/assets/.
//
// Por cada slide emite tres anchos — 900w, 1600w y el base de 2880w sin
// sufijo — porque son exactamente los que declara el srcset de index.html y
// el <link rel="preload" imagesrcset> de la slide 1. Cambiar un ancho aquí
// obliga a cambiarlo allá.
//
// El script no reencuadra por su cuenta: cada slide declara su `aspect` y su
// `focus` abajo. Un recorte automático (sharp tiene strategy: attention) elige
// por saliencia visual, que en una foto aérea nocturna es el parche de luces
// más brillante — no necesariamente el sujeto.
import sharp from "sharp";
import fs from "fs";
import path from "path";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const SRC = arg("--src", "assets-src/hero");
const OUT = arg("--out", "public/assets");
const WIDTHS = [900, 1600, 2880];

// `focus` es el centro vertical del recorte, 0 = borde superior, 1 = inferior.
// Solo se aplica cuando hay que recortar, es decir cuando el ratio nativo no
// coincide con `aspect`.
const SLIDES = [
  { src: "slide1_fly_droneitor.jpg", out: "slide-1-bayfront", aspect: 4 / 3, focus: 0.5, quality: 76 },
  { src: "slide3_fly_droneitor.jpg", out: "slide-2-jetty", aspect: 4 / 3, focus: 0.5, quality: 76 },
  { src: "slide4_fly_droneitor.jpg", out: "slide-3-moonrise", aspect: 4 / 3, focus: 0.5, quality: 76 },
  { src: "slide5_fly_droneitor.jpg", out: "slide-4-graffiti", aspect: 4 / 3, focus: 0.5, quality: 76 },
  { src: "slide6_fly_droneitor.jpg", out: "slide-5-skyline", aspect: 4 / 3, focus: 0.5, quality: 76 },
  // Original vertical (0.80). Se lleva a cuadrado en vez de a 4:3 para no
  // tirar la mitad de la foto: en móvil el hero es más alto que ancho y ese
  // alto extra sí se ve. focus 0.55 recorta las nubes de arriba y conserva la
  // banda skyline + Ocean Drive, que es lo que se muestra en desktop.
  { src: "slide7_fly_droneitor.jpg", out: "slide-6-oceandrive", aspect: 1, focus: 0.55, quality: 72 },
];

// Geometría del recorte: el mayor rectángulo con el aspect pedido que quepa en
// el original, centrado horizontalmente y colocado según `focus` en vertical.
async function planSlide(slide) {
  const file = path.join(SRC, slide.src);
  const { width: W, height: H } = await sharp(file).metadata();

  let cw, ch;
  if (W / H > slide.aspect) {
    ch = H;
    cw = Math.round(H * slide.aspect);
  } else {
    cw = W;
    ch = Math.round(W / slide.aspect);
  }
  const left = Math.round((W - cw) / 2);
  // El focus se clampa para que el recorte no se salga de la imagen.
  const top = Math.min(Math.max(Math.round(H * slide.focus - ch / 2), 0), H - ch);

  return { slide, file, W, H, cw, ch, left, top };
}

async function buildSlide(plan) {
  const { slide, file, W, H, cw, ch, left, top } = plan;
  const cropped = sharp(file).extract({ left, top, width: cw, height: ch });
  const results = [];

  for (const w of WIDTHS) {
    const name = w === 2880 ? `${slide.out}.webp` : `${slide.out}-${w}w.webp`;
    const dest = path.join(OUT, name);
    const info = await cropped
      .clone()
      .resize({ width: w })
      .webp({ quality: slide.quality, effort: 6 })
      .toFile(dest);
    results.push({ name, w, h: info.height, kb: info.size / 1024 });
  }

  console.log(`${slide.out}  (${W}x${H} -> recorte ${cw}x${ch} @ focus ${slide.focus})`);
  for (const r of results) {
    console.log(`    ${r.name.padEnd(34)} ${String(r.w).padStart(4)}x${String(r.h).padStart(4)}  ${r.kb.toFixed(0).padStart(4)} KB`);
  }
  return results;
}

// Pre-vuelo: se valida el set entero ANTES de escribir nada. Si una sola foto
// se queda corta y abortáramos a media generación, public/assets/ quedaría con
// slides de dos variantes en vez de tres y el srcset daría 404 justo en la
// grande — la que piden desktop y retina.
const missing = SLIDES.filter((s) => !fs.existsSync(path.join(SRC, s.src)));
if (missing.length) {
  console.error(`Faltan ${missing.length} de ${SLIDES.length} originales en ${SRC}/:`);
  for (const s of missing) console.error(`    ${s.src}  (iba a ser ${s.out})`);
  console.error(`\nHay: ${fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png)$/i.test(f)).join(", ") || "ningún JPEG"}`);
  console.error("Ajusta la lista SLIDES de este script para que coincida con los archivos entregados.");
  process.exit(1);
}

const plans = await Promise.all(SLIDES.map(planSlide));
const maxWidth = Math.max(...WIDTHS);
const tooSmall = plans.filter((p) => p.cw < maxWidth);
if (tooSmall.length) {
  for (const p of tooSmall) {
    console.error(`${p.slide.src}: el recorte a ${p.slide.aspect.toFixed(2)}:1 da ${p.cw}px de ancho, menos que la variante de ${maxWidth}w. No se escala hacia arriba.`);
    console.error(`    original ${p.W}x${p.H} — hace falta al menos ${maxWidth}x${Math.ceil(maxWidth / p.slide.aspect)}.`);
  }
  process.exit(1);
}

const all = [];
for (const plan of plans) all.push(...(await buildSlide(plan)));
const total = all.reduce((a, r) => a + r.kb, 0);
const heaviest = all.reduce((a, r) => (r.kb > a.kb ? r : a));
console.log(`\n${all.length} archivos, ${(total / 1024).toFixed(1)} MB en total.`);
console.log(`Más pesado: ${heaviest.name} (${heaviest.kb.toFixed(0)} KB)`);
