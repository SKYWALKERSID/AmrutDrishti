import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.serving import Handler, ThreadingHTTPServer

if __name__ == "__main__":
    token = os.environ.get("JALDRISHTI_MODEL_SERVICE_TOKEN", "")
    if not token:
        raise SystemExit("JALDRISHTI_MODEL_SERVICE_TOKEN must be set before starting the model service")
    port = int(os.environ.get("JALDRISHTI_MODEL_SERVICE_PORT", "8081"))
    print(f"Starting private model service on http://127.0.0.1:{port} ...", flush=True)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
