/**
 * sprites.js - Todos los sprites del juego dibujados con Canvas 2D pixel a pixel.
 * Cero imágenes externas.
 *
 * Cambios v2:
 *  - Armaduras con textura cuadriculada estilo MU Online (chainmail/escamas)
 *  - Spider rediseñada: 12×10, 8 patas visibles, dos segmentos corporales
 *  - DROP_BOX: cofre de madera con bisagras doradas (8×6)
 */

'use strict';

// ─── Utilidad base ────────────────────────────────────────────────────────────

function drawPixelSprite(ctx, spriteData, x, y, scale = 2) {
  spriteData.forEach((row, ry) => {
    row.forEach((color, rx) => {
      if (color !== 0 && color !== null) {
        ctx.fillStyle = color;
        ctx.fillRect(
          Math.floor(x + rx * scale),
          Math.floor(y + ry * scale),
          scale, scale
        );
      }
    });
  });
}

// ─── Paletas de color ────────────────────────────────────────────────────────

const PAL = {
  // Skin
  SKIN:  '#FDBCB4',
  SKIN2: '#E89F93',
  // Pelos
  HAIR_DARK:  '#2C1B0E',
  HAIR_BROWN: '#6B3F1E',
  HAIR_GOLD:  '#F5C842',
  // DK — armadura de placas con malla (azul oscuro / plateado)
  DK_ARMOR:  '#2E4A6E',
  DK_ARMOR2: '#1A2D45',
  DK_TRIM:   '#8CAAD4',   // highlight de malla (más claro = cuadro brillante)
  DK_SWORD:  '#C0C0C0',
  DK_VISOR:  '#1A3050',
  // DW — túnica con patrón de rombos (púrpura / negro)
  DW_ROBE:   '#4A1A6E',
  DW_ROBE2:  '#2D0F42',
  DW_TRIM:   '#9B59B6',
  DW_STAFF:  '#D4AC0D',
  DW_GEM:    '#00BFFF',
  // ELF — cuero con escamas (verde / marrón)
  ELF_VEST:  '#2E6E2E',
  ELF_VEST2: '#1A451A',
  ELF_TRIM:  '#52BE52',   // escama clara
  ELF_BOW:   '#8B4513',
  ELF_BOOT:  '#5C3A1A',
  // Monstruos
  BUDGE_BODY: '#C0392B',
  BUDGE_WING: '#922B21',
  BUDGE_BELLY:'#F1948A',
  GOB_BODY:   '#27AE60',
  GOB_BODY2:  '#1E8449',
  GOB_EYE:    '#E74C3C',
  SPIDER_BODY:'#7D3C98',  // cefalotórax (brillante)
  SPIDER_ABDO:'#5B2C6F',  // abdomen (más oscuro)
  SPIDER_LEG: '#4A235A',  // patas
  SPIDER_EYE: '#FF0000',  // ojos rojos
  // Tiles
  GRASS:   '#4A7C3F',
  GRASS2:  '#3D6535',
  PATH:    '#C8A96E',
  PATH2:   '#B8945A',
  WATER:   '#2980B9',
  WATER2:  '#1A6FA0',
  STONE:   '#7F8C8D',
  STONE2:  '#616A6B',
  TREE_TR: '#2E7D32',
  TREE_TR2:'#1B5E20',
  TREE_TR3:'#43A047',
  TREE_TRUNK:'#795548',
  WALL_G:  '#7F8C8D',
  WALL_G2: '#566573',
  BUILD_W: '#D5D8DC',
  BUILD_W2:'#BFC9CA',
  BUILD_R: '#C0392B',
  // Items
  GOLD_C:  '#F1C40F',
  GOLD_C2: '#D4AC0D',
  POT_RED: '#E74C3C',
  POT_BODY:'#ECF0F1',
  // Drop Box — cofre de madera
  BOX_W:   '#8B4513',   // madera oscura
  BOX_W2:  '#CD853F',   // tapa (más clara)
  BOX_D:   '#5C2E00',   // sombra/bordes
  BOX_G:   '#FFD700',   // bisagras doradas
  BOX_L:   '#B8860B',   // candado bronce
};

// ─── Alias locales para legibilidad de sprites ────────────────────────────────

const A  = PAL.DK_ARMOR,  T  = PAL.DK_TRIM,   D2 = PAL.DK_ARMOR2;
const SK = PAL.SKIN;
const SW = PAL.DK_SWORD;
const R  = PAL.DW_ROBE,   RT = PAL.DW_TRIM,   RD = PAL.DW_ROBE2;
const ST = PAL.DW_STAFF;
const EV = PAL.ELF_VEST,  ET = PAL.ELF_TRIM,  EV2= PAL.ELF_VEST2;
const EB = PAL.ELF_BOW;

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER SPRITES  (12 wide × 10 tall)
// Textura cuadriculada en zonas de armadura: (col+row)%2 alterna A↔T (DK),
// R↔RT (DW), EV↔ET (ELF), creando el efecto de malla/escamas del MU original.
// ─────────────────────────────────────────────────────────────────────────────

// ── Dark Knight ── armadura de placas con malla chainmail ─────────────────────
const DK_S = [
  // Row 0  — casco completo con penacho dorado
  [0,  0,  0,   PAL.DK_TRIM, PAL.DK_TRIM,  PAL.DK_TRIM, PAL.DK_TRIM, 0,   0,  0,  0,  0],
  // Row 1  — visera cerrada: flancos de armadura, ranura de ojos
  [0,  0,  D2,  A,           PAL.DK_VISOR, PAL.DK_VISOR,A,           D2,  0,  0,  0,  0],
  // Row 2  — mentón con skin visible
  [0,  0,  0,   A,           SK,           SK,          A,            0,   0,  0,  0,  0],
  // Row 3  — hombros: borde D2 + malla interior (col+row alternado)
  [0,  0,  D2,  T,           A,            T,           A,            D2,  0,  0,  0,  0],
  // Row 4  — pecho: malla chainmail alternada
  [0,  0,  A,   T,           A,            T,           A,            T,   0,  0,  0,  0],
  // Row 5  — cuerpo: espada a los lados, malla en el centro
  [0,  SW, T,   A,           T,            A,           T,            A,   SW, 0,  0,  0],
  // Row 6  — cuerpo inferior: espada + malla
  [0,  SW, A,   T,           A,            T,           A,            T,   SW, 0,  0,  0],
  // Row 7  — cintura: hebilla central, malla
  [0,  0,  T,   A,           D2,           D2,          A,            T,   0,  0,  0,  0],
  // Row 8  — muslos separados
  [0,  0,  A,   0,           T,            A,           0,            A,   0,  0,  0,  0],
  // Row 9  — botas oscuras
  [0,  0,  D2,  0,           D2,           D2,          0,            D2,  0,  0,  0,  0],
];

// ── Dark Wizard ── túnica con patrón de rombos ────────────────────────────────
const DW_S = [
  // Row 0  — capucha puntiaguda
  [0,  0,  0,  RT, RT, RT, 0,  0,  0,  0,  0,  0],
  // Row 1  — cara bajo capucha
  [0,  0,  R,  SK, SK, SK, R,  0,  0,  0,  0,  0],
  // Row 2  — cara
  [0,  0,  R,  SK, SK, SK, R,  0,  0,  0,  0,  0],
  // Row 3  — hombros: bordes RD + diamante de trim
  [0,  RD, RT, R,  RD, R,  RT, RD, 0,  0,  0,  0],
  // Row 4  — túnica + báculo: patrón rombo
  [0,  RD, R,  RT, R,  RT, R,  RD, 0,  0,  0,  0],
  // Row 5  — cuerpo con báculo: gema arriba
  [ST, RD, RT, R,  RT, R,  RT, RD, 0,  0,  0,  0],
  // Row 6  — cuerpo inferior
  [ST, 0,  R,  RT, R,  RT, R,  0,  0,  0,  0,  0],
  // Row 7  — falda de túnica (más ancha)
  [ST, 0,  0,  RT, R,  R,  RT, 0,  0,  0,  0,  0],
  // Row 8  — pies
  [0,  0,  0,  RD, 0,  0,  RD, 0,  0,  0,  0,  0],
  // Row 9  — pies
  [0,  0,  0,  RD, 0,  0,  RD, 0,  0,  0,  0,  0],
];

// ── Elf ── cuero con escamas de hoja ─────────────────────────────────────────
const ELF_S = [
  // Row 0  — cabello dorado (orejas puntiagudas a los lados)
  [0,  0,  0,  PAL.HAIR_GOLD, PAL.HAIR_GOLD, PAL.HAIR_GOLD, 0,   0,   0,  0,  0,  0],
  // Row 1  — cara
  [0,  0,  EV, SK, SK, SK, EV,  0,  0,  0,  0,  0],
  // Row 2  — cara
  [0,  0,  EV, SK, SK, SK, EV,  0,  0,  0,  0,  0],
  // Row 3  — hombros: borde EV2 + escamas ET
  [0,  EV2,EV, ET, EV, ET, EV,  EV2,0,  0,  0,  0],
  // Row 4  — pecho con arco: escamas alternadas
  [0,  EB, ET, EV, ET, EV, ET,  EB, EB, 0,  0,  0],
  // Row 5  — cuerpo: escamas más densas
  [0,  EB, EV, ET, EV, ET, EV,  EV2,EB, 0,  0,  0],
  // Row 6  — cuerpo inferior: escamas
  [0,  EB, ET, EV, ET, EV, ET,  EV, EB, 0,  0,  0],
  // Row 7  — cintura con cinturón oscuro
  [0,  0,  EV2,EV, ET, ET, EV,  EV2,0,  0,  0,  0],
  // Row 8  — muslos
  [0,  0,  EV, 0,  EV, EV, 0,   EV, 0,  0,  0,  0],
  // Row 9  — botas marrones
  [0,  0,  PAL.ELF_BOOT,0,PAL.ELF_BOOT,PAL.ELF_BOOT,0,PAL.ELF_BOOT,0,0,0,0],
];

const PLAYER_SPRITES = { DK: DK_S, DW: DW_S, ELF: ELF_S };

// ─────────────────────────────────────────────────────────────────────────────
// MONSTER SPRITES
// ─────────────────────────────────────────────────────────────────────────────

// ── Budge Dragon (12×9) ───────────────────────────────────────────────────────
const BW = PAL.BUDGE_WING, BB = PAL.BUDGE_BODY, BL = PAL.BUDGE_BELLY, RE = PAL.GOB_EYE;
const BUDGE_DRAGON = [
  [0,  BW, BW, 0,  0,  0,  0,  0,  BW, BW, 0,  0],
  [BW, BW, BB, BB, BB, BB, BB, BB, BB, BW, BW, 0],
  [BW, BB, BB, RE, BB, BB, RE, BB, BB, BB, BW, 0],
  [0,  BB, BL, BL, BL, BL, BL, BL, BB, 0,  0,  0],
  [0,  BB, BL, BL, BL, BL, BL, BL, BB, 0,  0,  0],
  [BW, BB, BB, BB, BB, BB, BB, BB, BB, BW, 0,  0],
  [BW, BB, BL, BL, BL, BL, BL, BB, BB, BW, 0,  0],
  [0,  BB, BB, 0,  BB, BB, 0,  BB, 0,  0,  0,  0],
  [0,  BW, BW, 0,  BW, BW, 0,  BW, 0,  0,  0,  0],
];

// ── Goblin (10×9) ─────────────────────────────────────────────────────────────
const GB = PAL.GOB_BODY, GB2 = PAL.GOB_BODY2, GE = PAL.GOB_EYE;
const GOBLIN = [
  [0,  0,  GB,  GB,  GB,  GB,  GB,  0,  0,  0],
  [0,  GB, GB2, GE,  GB,  GB,  GE,  GB2,GB, 0],
  [0,  GB, GB,  GB,  GB,  GB,  GB,  GB, GB, 0],
  [0,  0,  GB2, GB,  GB,  GB,  GB,  GB2,0,  0],
  [GB, 0,  GB2, GB,  GB2, GB,  GB,  GB2,0,  GB],
  [GB, 0,  GB,  GB,  GB,  GB,  GB,  GB, 0,  GB],
  [0,  0,  GB2, GB,  GB,  GB,  GB,  GB2,0,  0],
  [0,  0,  GB,  0,   GB,  GB,  0,   GB, 0,  0],
  [0,  0,  GB2, 0,   GB2, GB2, 0,   GB2,0,  0],
];

// ── Spider (12×10) — rediseñada con 8 patas y dos segmentos corporales ────────
// SL=patas, SB=cefalotórax(brillante), SA=abdomen(oscuro), SE=ojos rojos
const SL = PAL.SPIDER_LEG, SB = PAL.SPIDER_BODY, SA = PAL.SPIDER_ABDO, SE = PAL.SPIDER_EYE;
const SPIDER = [
  // Row 0  — 4 patas superiores extendidas (par 1 y par 2)
  [SL, 0,  SL, 0,  0,  0,  0,  0,  SL, 0,  SL, 0],
  // Row 1  — patas se acercan al cuerpo + inicio del cefalotórax
  [0,  SL, 0,  SB, SB, SB, SB, SB, 0,  SL, 0,  0],
  // Row 2  — cefalotórax con 4 ojos rojos
  [SL, 0,  SB, SE, SB, SE, SE, SB, SE, 0,  SL, 0],
  // Row 3  — cuerpo ancho + par 3 de patas
  [0,  SL, SB, SB, SB, SB, SB, SB, SB, SL, 0,  0],
  // Row 4  — nexo entre cefalotórax y abdomen (cuello)
  [SL, 0,  0,  SB, SB, SB, SB, SB, 0,  0,  SL, 0],
  // Row 5  — abdomen empieza + par 4 de patas (bajas)
  [0,  SL, 0,  SA, SA, SA, SA, SA, 0,  SL, 0,  0],
  // Row 6  — abdomen en su punto más ancho
  [SL, 0,  SA, SA, SA, SA, SA, SA, SA, 0,  SL, 0],
  // Row 7  — abdomen
  [0,  SL, 0,  SA, SA, SA, SA, SA, 0,  SL, 0,  0],
  // Row 8  — abdomen se estrecha
  [0,  0,  SL, SA, SA, SA, SA, 0,  0,  SL, 0,  0],
  // Row 9  — punta del abdomen
  [0,  0,  0,  0,  SA, SA, 0,  0,  0,  0,  0,  0],
];

const MONSTER_SPRITES = {
  budge_dragon: BUDGE_DRAGON,
  goblin:       GOBLIN,
  spider:       SPIDER
};

// ─────────────────────────────────────────────────────────────────────────────
// ITEM SPRITES
// ─────────────────────────────────────────────────────────────────────────────

// ── Moneda de oro (6×6) ───────────────────────────────────────────────────────
const GC = PAL.GOLD_C, GC2 = PAL.GOLD_C2;
const GOLD_COIN = [
  [0,   GC2, GC,  GC,  GC2, 0  ],
  [GC2, GC,  GC,  GC,  GC,  GC2],
  [GC,  GC,  GC2, GC2, GC,  GC ],
  [GC,  GC,  GC2, GC2, GC,  GC ],
  [GC2, GC,  GC,  GC,  GC,  GC2],
  [0,   GC2, GC,  GC,  GC2, 0  ],
];

// ── Poción HP (5×8) ───────────────────────────────────────────────────────────
const HP_POTION = [
  [0,          0,          PAL.WALL_G,  PAL.WALL_G,  0         ],
  [0,          PAL.BUILD_W,PAL.BUILD_W2,PAL.BUILD_W, 0         ],
  [PAL.BUILD_W,PAL.POT_RED,PAL.POT_RED, PAL.POT_RED, PAL.BUILD_W],
  [PAL.BUILD_W,PAL.POT_RED,PAL.POT_RED, PAL.POT_RED, PAL.BUILD_W],
  [PAL.BUILD_W,PAL.POT_RED,PAL.POT_RED, PAL.POT_RED, PAL.BUILD_W],
  [PAL.BUILD_W,PAL.POT_RED,PAL.POT_RED, PAL.POT_RED, PAL.BUILD_W],
  [0,          PAL.BUILD_W,PAL.BUILD_W, PAL.BUILD_W, 0         ],
  [0,          0,          PAL.BUILD_W2,0,            0         ],
];

// ── Drop Box — cofre de madera con bisagras y candado (8×6) ─────────────────
// Se renderiza como item especial con brillo dorado pulsante en el renderer.
const BXW = PAL.BOX_W, BXW2 = PAL.BOX_W2, BXD = PAL.BOX_D, BXG = PAL.BOX_G, BXL = PAL.BOX_L;
const DROP_BOX = [
  // Row 0 — tapa de madera (más clara)
  [0,    BXW2, BXW2, BXW2, BXW2, BXW2, BXW2, 0   ],
  // Row 1 — franja con bisagras doradas
  [0,    BXG,  BXW2, BXW2, BXW2, BXW2, BXG,  0   ],
  // Row 2 — frente superior del cofre
  [BXD,  BXW,  BXW,  BXW,  BXW,  BXW,  BXW,  BXD ],
  // Row 3 — candado central
  [BXD,  BXW,  BXW,  BXL,  BXL,  BXW,  BXW,  BXD ],
  // Row 4 — frente inferior
  [BXD,  BXW,  BXW,  BXW,  BXW,  BXW,  BXW,  BXD ],
  // Row 5 — base con sombra
  [0,    BXD,  BXD,  BXD,  BXD,  BXD,  BXD,  0   ],
];

const ITEM_SPRITES = {
  gold:     GOLD_COIN,
  hp_potion: HP_POTION,
  drop_box:  DROP_BOX
};

// ─── Tile rendering isométrica ────────────────────────────────────────────────

function drawIsoTile(ctx, sx, sy, tw, th, topColor, leftColor, rightColor, height) {
  const hw = tw / 2, hh = th / 2, h = height || 0;

  ctx.beginPath();
  ctx.moveTo(sx,      sy - hh - h);
  ctx.lineTo(sx + hw, sy - h);
  ctx.lineTo(sx,      sy + hh - h);
  ctx.lineTo(sx - hw, sy - h);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();

  if (h > 0) {
    ctx.beginPath();
    ctx.moveTo(sx - hw, sy - h);
    ctx.lineTo(sx,      sy + hh - h);
    ctx.lineTo(sx,      sy + hh);
    ctx.lineTo(sx - hw, sy);
    ctx.closePath();
    ctx.fillStyle = leftColor || shadeColor(topColor, -30);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(sx + hw, sy - h);
    ctx.lineTo(sx,      sy + hh - h);
    ctx.lineTo(sx,      sy + hh);
    ctx.lineTo(sx + hw, sy);
    ctx.closePath();
    ctx.fillStyle = rightColor || shadeColor(topColor, -50);
    ctx.fill();
  }
}

function shadeColor(hex, amount) {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1,3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3,5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5,7), 16) + amount));
  return `rgb(${r},${g},${b})`;
}

// ─── Tile color lookup ────────────────────────────────────────────────────────

const TILE_DEFS = {
  0: { top: PAL.GRASS,  left: '#3A6030', right: '#2E4D26', h: 0,  label: 'grass'    },
  1: { top: PAL.PATH,   left: '#A07840', right: '#8A6630', h: 0,  label: 'path'     },
  2: { top: PAL.WATER,  left: '#1A5F90', right: '#145080', h: 0,  label: 'water', anim: true },
  3: { top: PAL.TREE_TR,left: '#1B5E20', right: '#145018', h: 20, label: 'tree'     },
  4: { top: PAL.BUILD_W,left: '#A0A8A8', right: '#808888', h: 24, label: 'building' },
  5: { top: PAL.WALL_G, left: '#4A5258', right: '#3A4248', h: 16, label: 'wall'     },
  6: { top: PAL.STONE,  left: '#5A6366', right: '#4A5358', h: 2,  label: 'stone'    },
};

// ─── Offscreen sprite cache ───────────────────────────────────────────────────

const _spriteCache = new Map();
function getCachedSprite(key, drawFn, w, h) {
  if (_spriteCache.has(key)) return _spriteCache.get(key);
  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h;
  const octx = oc.getContext('2d');
  octx.imageSmoothingEnabled = false;
  drawFn(octx);
  _spriteCache.set(key, oc);
  return oc;
}

// ─── Sombra bajo entidades ────────────────────────────────────────────────────

function drawShadow(ctx, sx, sy, rx, ry) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx || 10, ry || 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Export ───────────────────────────────────────────────────────────────────

window.Sprites = {
  draw: drawPixelSprite,
  drawIsoTile,
  drawShadow,
  shadeColor,
  getCachedSprite,
  PLAYER:   PLAYER_SPRITES,
  MONSTER:  MONSTER_SPRITES,
  ITEM:     ITEM_SPRITES,
  TILE_DEFS,
  PAL
};
