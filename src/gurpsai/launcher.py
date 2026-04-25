import uvicorn
import webbrowser
import threading
import time
import socket
from contextlib import closing

from gurpsai.api.main import app

def find_free_port():
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(('', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]

def open_browser(port):
    time.sleep(1.5)  # Give uvicorn a moment to bind and boot
    url = f"http://127.0.0.1:{port}"
    print(f"Opening browser at -> {url}")
    webbrowser.open(url)

def main():
    target_port = 8000
    
    # Try port 8000 first, if taken fallback to random
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        if s.connect_ex(('127.0.0.1', target_port)) == 0:
            target_port = find_free_port()
            
    print(f"Starting GURPS Assistant on port {target_port}...")
            
    threading.Thread(target=open_browser, args=(target_port,), daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=target_port, log_level="info")

if __name__ == "__main__":
    main()
