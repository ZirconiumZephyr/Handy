"""Optional loopback OpenMed worker. Run only with locally downloaded model weights.
No request-body logging, CORS, cloud API or network model downloads are enabled.
"""
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
from openmed import deidentify  # noqa: E402

MODEL = os.environ.get("CONSULT_OPENMED_MODEL")
if not MODEL or not os.path.isdir(MODEL):
    raise SystemExit("Set CONSULT_OPENMED_MODEL to an existing local OpenMed PII model directory.")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        if self.path != "/deidentify":
            self.send_error(404)
            return
        # Prevent browser cross-origin requests to the local service.
        if self.headers.get("Origin"):
            self.send_error(403)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > 2_000_000:
                self.send_error(413)
                return
            text = json.loads(self.rfile.read(size))["text"]
            if not isinstance(text, str):
                raise ValueError("Invalid text")
            result = deidentify(text, model_name=MODEL, method="mask")
            body = json.dumps({"text": result.deidentified_text}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception:
            self.send_error(500, "Local de-identification failed")


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8766), Handler).serve_forever()
