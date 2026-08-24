# Originales del slider del hero

Aquí van los JPEG a máxima resolución. No se publican: `wrangler` solo sube lo
que vive bajo `public/`, así que esta carpeta es insumo de build. Las variantes
servidas las genera `node scripts/build-hero-images.mjs` hacia `public/assets/`.

Los originales están en `.gitignore` — pesan decenas de MB y se pueden volver a
pedir. Lo que sí está versionado es el script y el resultado comprimido.

## Qué debe cumplir cada foto

| | Requisito |
|---|---|
| Formato | JPEG, sin recortar, tal cual sale de cámara |
| Ancho mínimo | **2880 px** después del recorte al ratio objetivo |
| Ratio ideal | 4:3 o 3:2 horizontal |
| Nombre | `N-tema.jpg` (`1-villa.jpg`, `2-obra.jpg`…) — el número fija el orden en el slider |

La #1 es la única que se precarga y se muestra sin lazy-load: es el LCP que
mide Google. Debe ser la más fuerte y, a igualdad de todo, la que comprima más
ligero.

## Encuadre

El hero es a sangre completa (`min-height:100svh`) con `object-fit:cover`, así
que la foto siempre llena la pantalla y se recorta el sobrante. Tres
consecuencias, y la primera sorprende:

- **En escritorio se pierde casi el 40% del alto.** La caja del hero es
  ~2.1:1 y las fotos 4:3, así que solo se ve la banda central del 63%: 18.4%
  fuera por arriba y otro tanto por abajo. Una foto cuyo interés esté en el
  cielo o en el suelo llega recortada. Se compensa por foto con `--pos-y`
  (`object-position` vertical), no reencodeando.
- **Nada importante pegado a los bordes.** El Ken Burns escala hasta 1.18 y
  desplaza ±2%, así que el borde se come más de lo que parece.
- **En móvil el recorte es horizontal, no vertical.** La caja es ≈0.46:1, más
  alta que ancha, así que se conserva todo el alto y se recortan los lados: de
  una 4:3 solo se ve el 34% central. El sujeto tiene que estar cerca del eje.

Encima va un degradado oscuro para que el texto blanco sea legible: en desktop
entra por la izquierda (donde vive el copy) y en móvil por arriba. Fotos con un
parche muy claro justo ahí obligan a subir ese velo y se ven apagadas. Zonas
oscuras o de textura uniforme bajo el texto son las que mejor funcionan.

El alpha del velo se calcula por foto —`scripts/build-hero-images.mjs` mide el
percentil 90 de luminancia de la zona que queda bajo el texto y despeja el
alpha que da 4.5:1 contra blanco— y se imprime listo para pegar en
`styles.css`. No se ajusta a ojo, y **`--pos-y` y `--scrim-d` van juntos**: el
velo se mide sobre la banda que `--pos-y` deja visible, así que tocar uno sin
el otro invalida la medición.

## Cobertura de servicios

La landing vende **bienes raíces, eventos y construcción**, y las secciones de
beneficios hablan de eso. El set debe ilustrar los tres; un carrusel solo de
ciudad y paisaje se ve bien pero no respalda lo que promete el copy.

El set entregado en agosto de 2026 lo cumple: construcción y eventos con dos
fotos cada uno, bienes raíces con una, y tres de ciudad/paisaje como apertura y
cierre. Ojo con el etiquetado del nombre de archivo, que no siempre acierta —
`slide3_real_estate` es en realidad una torre urbana cubierta de grafiti.
