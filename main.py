import os
import sys
import subprocess
import threading
from spy import spy_loop

def start_spy_bg():
    try:
        print("[CASSINO V-7.0] Iniciando Python Spy Loop em background...")
        spy_loop()
    except Exception as e:
        print(f"[CASSINO V-7.0] Erro no Python Spy Loop: {e}")

if __name__ == "__main__":
    print("Iniciando CASSINO V-7.0 Full-Stack (Web Painel + Python Spy)...")
    
    # 1. Run main Python spy loop in background thread
    spy_thread = threading.Thread(target=start_spy_bg, daemon=True)
    spy_thread.start()
    
    # 2. Build Web Painel if dist/server.cjs does not exist
    if not os.path.exists("dist/server.cjs"):
        print("[CASSINO V-7.0] Compilando painel web (npm run build)...")
        subprocess.run("npm run build", shell=True)

    # 3. Start Node Web Painel server on PORT (serves React Dashboard UI)
    print("[CASSINO V-7.0] Subindo servidor web (Node.js Express + React Painel)...")
    if os.path.exists("dist/server.cjs"):
        os.execvP("node", "node", ["node", "dist/server.cjs"])
    else:
        os.execvP("npm", "npm", ["npm", "start"])

