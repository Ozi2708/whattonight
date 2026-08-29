#!/usr/bin/env node
/**
 * Génère les icônes de l'app dans public/ à partir d'un tracé vectoriel.
 *
 * Le glyphe reprend la fenêtre de roulette de la barre d'onglets : trois
 * colonnes dans un cadre arrondi. Lisible à 48 px comme à 512 px.
 *
 * Usage : npm run icons
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public')

const INK = '#07070b'
const GOLD = '#ffc94a'

/**
 * @param size    côté du canevas, en px
 * @param cover   part de la largeur occupée par le glyphe
 * @param bg      fond, ou `null` pour un fond transparent
 */
function icon(size, cover, bg = INK) {
  const w = size * cover
  const h = (w * 62) / 100 // le glyphe est dessiné dans un repère 100 × 72
  const x = (size - w) / 2
  const y = (size - h) / 2
  const s = w / 100 // le trait est exprimé dans le repère local, donc mis à l'échelle avec lui

  // Deux cercles, et leur intersection pleine : la marque, c'est le terrain
  // commun — pas les deux personnes prises séparément.
  const id = `lens${size}${Math.round(cover * 100)}`
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
  <defs><clipPath id="${id}"><circle cx="35" cy="31" r="26"/></clipPath></defs>
  <g transform="translate(${x} ${y}) scale(${s})">
    <g clip-path="url(#${id})"><circle cx="65" cy="31" r="26" fill="${GOLD}"/></g>
    <g fill="none" stroke="${GOLD}" stroke-width="6">
      <circle cx="35" cy="31" r="26"/>
      <circle cx="65" cy="31" r="26"/>
    </g>
  </g>
</svg>`)
}

const png = (svg, size, file) =>
  sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(OUT, file))

async function main() {
  await mkdir(OUT, { recursive: true })

  // Icônes classiques : le glyphe peut occuper une large part du canevas.
  await png(icon(192, 0.68), 192, 'icon-192.png')
  await png(icon(512, 0.68), 512, 'icon-512.png')

  // Maskable : Android recadre en cercle/goutte. Le glyphe reste dans la zone
  // sûre (80 % centraux), le fond doit couvrir tout le canevas.
  await png(icon(512, 0.52), 512, 'icon-maskable-512.png')

  // iOS n'applique pas de masque et n'accepte pas la transparence.
  await png(icon(180, 0.66), 180, 'apple-touch-icon.png')

  await writeFile(resolve(OUT, 'favicon.svg'), icon(64, 0.78).toString(), 'utf8')

  console.log('✓ icônes écrites dans public/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
