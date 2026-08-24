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
//
// Al final imprime el bloque CSS con el velo (`--scrim-d` / `--scrim-m`) de
// cada slide, medido sobre la foto ya recortada. Se pega en styles.css. Se
// calcula en vez de fijarse a ojo para que cambiar una foto no deje el número
// viejo: un velo de más apaga la foto, uno de menos deja el texto ilegible.
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
// El set entregado es 4:3 nativo (1.33-1.34) en las ocho, así que `aspect`
// solo recorta una tira de ~0.5% de los lados y `focus` da igual. El orden
// abre con la bahía (la más fuerte, y la que menos velo pide) y coloca los
// tres servicios en las posiciones 2-4, que es hasta donde llega la mayoría.
// `posY` es el object-position vertical con el que el navegador recorta la
// foto en escritorio, donde la caja panorámica solo deja ver el 63% del alto.
// Va aquí y no solo en el CSS porque el velo se mide sobre la banda que ese
// valor deja visible: cambiar uno sin el otro descuadra la medición.
const SLIDES = [
  // 0.13 en vez de centrado: a 0.5 la banda visible empieza por debajo del
  // skyline y se pierde el atardecer, que es lo que hace fuerte a esta foto.
  { src: "slide1_others_fly_droneitor.jpg",      out: "slide-1-bayfront",   aspect: 4 / 3, focus: 0.5, posY: 0.13, quality: 76 },
  { src: "slide7_real_estate_fly_droneitor.jpg", out: "slide-2-villa",      aspect: 4 / 3, focus: 0.5, posY: 0.50, quality: 76 },
  { src: "slide8_events_fly_droneitor.jpg",      out: "slide-3-nightlife",  aspect: 4 / 3, focus: 0.5, posY: 0.45, quality: 76 },
  { src: "slide2_building_fly_droneitor.jpg",    out: "slide-4-homebuild",  aspect: 4 / 3, focus: 0.5, posY: 0.58, quality: 76 },
  { src: "slide5_others_fly_droneitor.jpg",      out: "slide-5-skyline",    aspect: 4 / 3, focus: 0.5, posY: 0.40, quality: 76 },
  { src: "slide6_building_fly_droneitor.jpg",    out: "slide-6-highrise",   aspect: 4 / 3, focus: 0.5, posY: 0.50, quality: 76 },
  { src: "slide4_events_fly_droneitor.jpg",      out: "slide-7-motorsport", aspect: 4 / 3, focus: 0.5, posY: 0.50, quality: 76 },
  { src: "slide3_real_estate_fly_droneitor.jpg", out: "slide-8-downtown",   aspect: 4 / 3, focus: 0.5, posY: 0.42, quality: 76 },
];

// --- Velo -----------------------------------------------------------------
// El hero es a sangre, así que qué parte de la foto acaba bajo el texto
// depende de tres cosas: la forma de la caja, dónde cae el copy dentro de
// ella, y el object-position de la foto. Medir sobre un recuadro fijo de la
// foto da un número equivocado — la primera versión de esto asumió una caja
// 16:9 y se quedó corta en cinco de las ocho slides.
//
// `aspect` y `copy` salen de medir el render real (getBoundingClientRect
// sobre .hero y sobre el bloque de texto), no de estimarlos.
const HERO = {
  // 1440x900 -> caja 2.108:1. Un 1920x1080 da 2.02 y un portátil 1280x800 da
  // 1.97, así que 2.108 es el más panorámico de los habituales: el que menos
  // foto deja ver y por tanto el caso que hay que cubrir.
  d: { aspect: 2.108, copy: { x0: 0.188, x1: 0.486, y0: 0.354, y1: 0.711 } },
  // En móvil la caja es más alta que ancha, así que `cover` recorta los
  // LADOS y conserva todo el alto: no hay banda vertical que calcular y el
  // object-position vertical no interviene.
  m: { aspect: 0.46, copy: { x0: 0.08, x1: 0.92, y0: 0.16, y1: 0.55 } },
};

// Región de la foto que queda bajo el texto, en fracciones del recorte.
function textRegion(photoAspect, hero, posY) {
  if (hero.aspect > photoAspect) {
    // Escala al ancho: se ve el ancho entero y sobra alto, que se recorta
    // arriba y abajo según posY.
    const visible = photoAspect / hero.aspect;
    const top = (1 - visible) * posY;
    return {
      x0: hero.copy.x0, x1: hero.copy.x1,
      y0: top + hero.copy.y0 * visible,
      y1: top + hero.copy.y1 * visible,
    };
  }
  const visible = hero.aspect / photoAspect;
  const left = (1 - visible) / 2;
  return {
    x0: left + hero.copy.x0 * visible,
    x1: left + hero.copy.x1 * visible,
    y0: hero.copy.y0, y1: hero.copy.y1,
  };
}
const SCRIM_RGB = [5, 7, 10];
// Se apunta a 4.7 para que el render real quede en 4.5 (AA del subtítulo, que
// es el texto exigente). El margen cubre la diferencia de remuestreo entre
// esta medición y la del navegador: apuntando justo a 4.5, tres de las ocho
// aterrizaban en 4.44-4.47.
const CONTRAST = 4.7;
const SCRIM_FLOOR = 0.4;         // por debajo el hero pierde el panel oscuro que lo define
const SCRIM_CEIL = 0.92;

const toLinear = (c) => (c /= 255) <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const luminance = (r, g, b) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

// Se mide el percentil 90, no la media: la media diluye un foco blanco entre
// mucha agua oscura y devuelve un velo que deja el texto encima del foco.
// Y se promedia en espacio lineal — promediar bytes sRGB, que son
// perceptuales, sobreestima el brillo de cualquier zona contrastada.
//
// Sin desenfocar, a propósito. Un blur previo suaviza justo los picos que el
// p90 busca: con blur(2) sobre 120px las ocho slides daban entre 0.04 y 0.08
// por debajo de lo que pide el render real.
// `crop` va en coordenadas del original, y la zona en fracciones de ese
// recorte. Se resuelve todo a coordenadas absolutas y se extrae de una sola
// pasada: encadenar dos .extract() sobre el mismo pipeline no compone, y
// .metadata() sobre un pipeline ya recortado sigue reportando el original.
async function scrimAlpha(file, crop, zone) {
  const { data } = await sharp(file)
    .extract({
      left: crop.left + Math.round(crop.width * zone.x0),
      top: crop.top + Math.round(crop.height * zone.y0),
      width: Math.round(crop.width * (zone.x1 - zone.x0)),
      height: Math.round(crop.height * (zone.y1 - zone.y0)),
    })
    .resize({ width: 200 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const values = [];
  for (let i = 0; i < data.length; i += 3) values.push(luminance(data[i], data[i + 1], data[i + 2]));
  values.sort((a, b) => a - b);
  const lit = values[Math.floor(values.length * 0.9)];

  // Blanco sobre el compuesto velo+foto. El velo es opaco en alpha, así que
  // la luminancia resultante interpola entre la foto y el color del velo.
  const target = 1.05 / CONTRAST - 0.05;
  const base = luminance(...SCRIM_RGB);
  const alpha = (lit - target) / (lit - base);
  // Hacia arriba, no al más cercano: el CSS lleva dos decimales y redondear a
  // la baja resta contraste justo donde no sobra.
  const rounded = Math.ceil(alpha * 100) / 100;
  return Math.max(SCRIM_FLOOR, Math.min(SCRIM_CEIL, rounded));
}

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

  const crop = { left, top, width: cw, height: ch };
  const posY = slide.posY ?? 0.5;
  const scrim = {
    d: await scrimAlpha(file, crop, textRegion(slide.aspect, HERO.d, posY)),
    m: await scrimAlpha(file, crop, textRegion(slide.aspect, HERO.m, posY)),
  };

  console.log(`${slide.out}  (${W}x${H} -> recorte ${cw}x${ch} @ posY ${posY})  velo ${scrim.d.toFixed(2)}/${scrim.m.toFixed(2)}`);
  for (const r of results) {
    console.log(`    ${r.name.padEnd(34)} ${String(r.w).padStart(4)}x${String(r.h).padStart(4)}  ${r.kb.toFixed(0).padStart(4)} KB`);
  }
  return { results, scrim };
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
const scrims = [];
for (const plan of plans) {
  const { results, scrim } = await buildSlide(plan);
  all.push(...results);
  scrims.push(scrim);
}
const total = all.reduce((a, r) => a + r.kb, 0);
const heaviest = all.reduce((a, r) => (r.kb > a.kb ? r : a));
console.log(`\n${all.length} archivos, ${(total / 1024).toFixed(1)} MB en total.`);
console.log(`Más pesado: ${heaviest.name} (${heaviest.kb.toFixed(0)} KB)`);

console.log("\n--- Pegar en styles.css, bloque «velo por foto» ---");
scrims.forEach((s, i) => {
  const posY = (SLIDES[i].posY ?? 0.5) * 100;
  console.log(
    `.heroSlide[data-slide="${i}"] { --scrim-d: ${s.d.toFixed(2)}; --scrim-m: ${s.m.toFixed(2)}; --pos-y: ${posY.toFixed(0)}%; }`
  );
});
