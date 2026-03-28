import asyncio
import json
import logging
import threading
import http.server
import socketserver
import random
import time
import math

try:
    import websockets
except ImportError:
    print("Por favor instala websockets con: pip install websockets")
    exit(1)

logging.basicConfig(level=logging.INFO)

# --- ESTADO DEL JUEGO RPG V2 ---
PLAYERS = {}       # id -> {x, y, z, rotY, hp, maxHp, level, exp}
CONNECTIONS = set()
MONSTERS = {}      # id -> {type (Spider), x, y, z, hp, maxHp, state}
DROPS = {}         # id -> {type (Bless/Soul/Zen), x, y, z}

# Helper function to spawn outside town (radius > 12)
def get_wild_spawn():
    x = random.uniform(15, 35) if random.random() > 0.5 else random.uniform(-35, -15)
    z = random.uniform(15, 35) if random.random() > 0.5 else random.uniform(-35, -15)
    return x, z

# Spawns iniciales (10 arañas)
for i in range(10):
    m_id = f"spider_{i}"
    rx, rz = get_wild_spawn()
    MONSTERS[m_id] = {
        "x": rx,
        "y": 0,
        "z": rz,
        "hp": 20, "maxHp": 20,
        "type": "Spider",
        "dead_time": 0
    }

def broadcast_state():
    if not CONNECTIONS: return
    # Limpiamos los monstruos muertos que exceden el tiempo antes de enviarlos
    active_monsters = {k:v for k,v in MONSTERS.items() if v["hp"] > 0}
    
    state = json.dumps({
        "type": "state",
        "players": PLAYERS,
        "monsters": active_monsters,
        "drops": DROPS
    })
    websockets.broadcast(CONNECTIONS, state)

# IA del Servidor: Mover Arañas
async def game_loop():
    while True:
        now = time.time()
        for m_id, m in MONSTERS.items():
            if m["hp"] <= 0:
                if now - m["dead_time"] > 10: # Respawn a los 10 segundos
                    m["hp"] = m["maxHp"]
                    rx, rz = get_wild_spawn()
                    m["x"] = rx
                    m["z"] = rz
                continue
            
            # Movimiento Aleatorio (Roam)
            if random.random() < 0.05: # Ocasionalmente cambiar dir
                m["dx"] = random.uniform(-0.1, 0.1)
                m["dz"] = random.uniform(-0.1, 0.1)
            
            if "dx" in m:
                m["x"] += m["dx"]
                m["z"] += m["dz"]
                # Limites
                m["x"] = max(-30, min(30, m["x"]))
                m["z"] = max(-30, min(30, m["z"]))

        # Check picks de los drops (Si la distancia entre drop y un player es < 2)
        dropped_to_delete = []
        for d_id, d in DROPS.items():
            for p_id, p in PLAYERS.items():
                dist = math.hypot(p["x"] - d["x"], p["z"] - d["z"])
                if dist < 2.0:
                    # Player la recoge (futuro inventario)
                    dropped_to_delete.append(d_id)
                    # Aquí añadiríamos a base de datos
                    break
                    
        for d in dropped_to_delete:
            if d in DROPS:
                del DROPS[d]
                
        broadcast_state()
        await asyncio.sleep(0.1) # 10 Ticks/seg

# WebSocket Handler
async def wshost(websocket):
    client_id = str(id(websocket))
    print(f"[{client_id}] INGRESO AL SERVER")
    CONNECTIONS.add(websocket)
    PLAYERS[client_id] = {"x": 0, "y": 0, "z": 0, "rotY": 0, "hp": 100, "maxHp": 100, "level": 1, "exp": 0}
    
    try:
        await websocket.send(json.dumps({"type": "init", "myId": client_id}))
        
        async for message in websocket:
            try:
                data = json.loads(message)
                if data["type"] == "move":
                    if client_id in PLAYERS:
                        p = PLAYERS[client_id]
                        p["x"] = data["x"]
                        p["y"] = data["y"]
                        p["z"] = data["z"]
                        p["rotY"] = data["rotY"]
                
                elif data["type"] == "attack":
                    # Calcular si el jugador golpeó a un monstruo
                    if client_id not in PLAYERS: continue
                    p = PLAYERS[client_id]
                    dmg = random.randint(3, 8) # Daño físico
                    
                    for m_id, m in MONSTERS.items():
                        if m["hp"] > 0:
                            dist = math.hypot(p["x"] - m["x"], p["z"] - m["z"])
                            # Chequear alcance de la espada (rango 3.0)
                            if dist < 3.0:
                                m["hp"] -= dmg
                                if m["hp"] <= 0:
                                    m["hp"] = 0
                                    m["dead_time"] = time.time()
                                    # Generar Botín (Drop)
                                    drop_id = f"drop_{time.time()}"
                                    drop_type = random.choice(["Zen", "Jewel of Bless", "Jewel of Soul", "Apple"])
                                    DROPS[drop_id] = {"type": drop_type, "x": m["x"], "y": 0, "z": m["z"]}
                                    
                                    # Otorgar EXP al asesino
                                    PLAYERS[client_id]["exp"] += 50
                                    if PLAYERS[client_id]["exp"] >= 300: # Level up simulado
                                        PLAYERS[client_id]["level"] += 1
                                        PLAYERS[client_id]["exp"] = 0
                                        PLAYERS[client_id]["maxHp"] += 20
                                        PLAYERS[client_id]["hp"] = PLAYERS[client_id]["maxHp"]
                                        # Todo: Mandar msj Level UI
                                        await websocket.send(json.dumps({"type": "levelup", "level": PLAYERS[client_id]["level"]}))
                                
            except Exception as e:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        print(f"[{client_id}] DISCONNECTED")
        if websocket in CONNECTIONS:
            CONNECTIONS.remove(websocket)
        if client_id in PLAYERS:
            del PLAYERS[client_id]

async def server_main():
    print(">> Backend RPG Server local iniciado en el puerto 8765")
    async with websockets.serve(wshost, "0.0.0.0", 8765):
        # Disparamos el Loop del mundo 3D en background
        asyncio.create_task(game_loop())
        await asyncio.Future()

def start_http_server():
    PORT = 8080
    
    import os
    # Nos movemos a la carpeta www donde viven los estáticos 
    www_dir = os.path.join(os.path.dirname(__file__), 'www')
    if os.path.exists(www_dir):
        os.chdir(www_dir)
        
    Handler = http.server.SimpleHTTPRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

if __name__ == "__main__":
    t = threading.Thread(target=start_http_server, daemon=True)
    t.start()
    asyncio.run(server_main())
