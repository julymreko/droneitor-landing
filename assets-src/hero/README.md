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
que la foto siempre llena la pantalla y se recorta el sobrante. Dos
consecuencias:

- **Nada importante pegado a los bordes.** El Ken Burns escala hasta 1.18 y
  desplaza ±2%, así que el borde se come más de lo que parece.
- **Cuanto más panorámica la foto, más brutal el recorte en móvil.** Un móvil
  vertical (≈0.46:1) solo muestra el 31% del ancho de una foto 3:2, y el 22% de
  una 2:1. El sujeto tiene que estar cerca del centro.

Encima va un degradado oscuro para que el texto blanco sea legible: en desktop
entra por la izquierda (donde vive el copy) y en móvil por arriba. Fotos con un
parche muy claro justo ahí obligan a subir ese velo y se ven apagadas. Zonas
oscuras o de textura uniforme bajo el texto son las que mejor funcionan.

El alpha del velo se calcula por foto midiendo la luminancia real de esa zona,
no a ojo.

## Cobertura de servicios — pendiente

La landing vende **bienes raíces, eventos y construcción**, y las secciones de
beneficios hablan de eso. El set debe ilustrar los tres. Un carrusel solo de
ciudad y paisaje se ve bien pero no respalda lo que promete el copy.
