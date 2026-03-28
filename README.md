# MU Pixel Realm

MMORPG pixel art inspirado en MU Online para Android + red LAN.

## Arquitectura

```
Servidor Node.js (Termux)  ←→  APK Android (Capacitor + WebView)
         ↑                              ↑
  Socket.io LAN WiFi          HTML5 Canvas isométrico
```

## Estructura del proyecto

```
mu-pixel/
├── .github/workflows/build-apk.yml  ← GitHub Actions compila el APK
├── server/
│   ├── index.js        ← Servidor principal (corre en Termux)
│   ├── GameWorld.js    ← Mapa, monstruos, lógica del mundo
│   ├── Player.js       ← Clase jugador
│   ├── Monster.js      ← Clase monstruo con IA
│   └── Combat.js       ← Cálculo de daño
├── client/
│   ├── index.html      ← App principal
│   ├── Game.js         ← Orquestador del juego
│   ├── Renderer.js     ← Motor isométrico pixel art
│   ├── TouchControls.js← Joystick virtual + botones
│   ├── InputHandler.js ← Gestión de input (touch + teclado)
│   ├── UI.js           ← HUD, minimap, chat
│   ├── NetworkClient.js← Socket.io cliente
│   └── assets/sprites.js ← Sprites pixel art (sin imágenes externas)
├── package.json        ← Capacitor + dependencias cliente
├── package-server.json ← Solo para Termux (servidor)
└── capacitor.config.json
```

---

## Setup Servidor en Termux

```bash
# 1. Instalar dependencias
pkg update && pkg upgrade
pkg install nodejs git

# 2. Clonar el repositorio
git clone https://github.com/TU_USUARIO/mu-pixel
cd mu-pixel

# 3. Instalar dependencias del servidor
cp package-server.json package.json
npm install

# 4. Iniciar el servidor
node server/index.js
```

Al iniciar verás algo como:
```
╔══════════════════════════════════════╗
║      MU PIXEL REALM  - SERVIDOR      ║
╠══════════════════════════════════════╣
║  Puerto: 3000                        ║
║  IPs disponibles:                    ║
║  → http://192.168.1.5:3000           ║
╚══════════════════════════════════════╝
```

Anota la IP que muestra (ej: `192.168.1.5`).

---

## Obtener el APK (GitHub Actions)

1. Sube este repositorio a GitHub
2. El APK se compila automáticamente al hacer `git push` a `main`
3. Ve a tu repo → **Actions** → último workflow exitoso → **Artifacts** → descarga `mu-pixel-debug`
4. O ve a **Releases** para la versión más reciente

### Compilar manualmente (si tienes Node.js instalado)

```bash
npm install
npx cap add android        # solo la primera vez
npx cap sync android
# Luego abrir en Android Studio o usar GitHub Actions
```

---

## Instalar el APK

1. Descarga `app-debug.apk` desde GitHub Actions/Releases
2. En tu Android: **Configuración → Seguridad → Fuentes desconocidas** (activar)
3. Abre el archivo APK e instala
4. ¡Listo!

---

## Jugar

### Paso 1: Iniciar el servidor
En Termux: `node server/index.js`

### Paso 2: Conectar
1. Abre el APK en tu Android
2. Ingresa la IP que mostró Termux (ej: `192.168.1.5`) y puerto `3000`
3. Toca **CONECTAR**

### Paso 3: Crear personaje
- Escribe un nombre
- Elige tu clase (DK / DW / ELF)
- Toca **ENTRAR AL MUNDO**

### Paso 4: Multijugador
- Otros jugadores en la misma WiFi abren el APK
- Ingresan la **misma IP** del servidor Termux
- ¡Todos juegan juntos en Lorencia!

---

## Controles

| Control | Acción |
|---------|--------|
| Joystick izquierdo | Mover personaje |
| **ATK** | Atacar objetivo seleccionado |
| **PCK** | Recoger item más cercano |
| **POT** | Usar poción HP |
| **SKL** | Usar habilidad |
| Tap en monstruo | Seleccionar y atacar |
| Tap en tile vacío | Mover ahí |
| Tap en item | Recoger |
| Pinch | Zoom in/out |
| Long press | Info de posición |

### Teclado (PC/debug)
| Tecla | Acción |
|-------|--------|
| WASD / Flechas | Mover |
| Espacio | Atacar objetivo |
| F | Usar poción HP |

---

## Clases

| Clase | STR | AGI | VIT | ENE | HP | MP | Arma |
|-------|-----|-----|-----|-----|----|----|------|
| Dark Knight | 28 | 20 | 25 | 10 | 110 | 60 | Espada (melee) |
| Dark Wizard | 15 | 15 | 15 | 40 | 80 | 150 | Bastón (rango) |
| Elf | 22 | 28 | 20 | 15 | 100 | 80 | Arco (rango) |

---

## Monstruos de Lorencia

| Monstruo | HP | ATK | EXP | Respawn |
|----------|----|-----|-----|---------|
| Budge Dragon | 50 | 6 | 10 | 30s |
| Goblin | 80 | 10 | 15 | 30s |
| Spider | 40 | 4 | 8 | 30s |

---

## Drops

- **Gold**: 100% chance (varía por monstruo)
- **Poción HP**: 25-30% chance
- **Equipo**: 5% chance

Los items brillan en el suelo y desaparecen a los 2 minutos.

---

## Mapa de Lorencia

```
[Árboles/Monstruos exterior]
    [Posada Norte]
[Tienda Pociones]  [Plaza Central]  [Almacén Este]
    [Tienda Sur]
[Árboles/Monstruos exterior]
```

- Mapa: 50×50 tiles isométricos
- Centro: Plaza de piedra (spawn)
- Zona de monstruos: bordes del mapa

---

## Notas técnicas

- **Zero imágenes externas**: todos los sprites con Canvas 2D fillRect
- **Predicción del cliente**: movimiento fluido sin esperar al servidor
- **Object pooling**: partículas y números de daño reutilizados
- **Culling**: solo se renderizan tiles visibles en pantalla
- **Resolución 2x**: canvas lógico a mitad de resolución, escalado con CSS (pixel art nítido)
- **Audio procedural**: Web Audio API, sin archivos de sonido

---

## Troubleshooting

**El APK no conecta al servidor:**
- Verifica que Termux esté corriendo con `node server/index.js`
- Ambos dispositivos deben estar en la misma WiFi
- Verifica la IP correcta en la pantalla de conexión
- Prueba hacer ping: `ping 192.168.X.X` desde otro terminal

**GitHub Actions falla:**
- Ve a Actions → ver el log de error
- Lo más común: falta `android/` generado por Capacitor
- El workflow lo genera automáticamente con `npx cap add android`

**Sprites no se ven:**
- Asegúrate de que `client/assets/sprites.js` está presente
- Verifica la consola del navegador (F12) para errores JS
