import json
import logging
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from trajectory import interception
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "public")  # change this

class ApiHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

class ApiHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, value):
        body = json.dumps(value, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/api/interception":
            self._send_json(404, {"error": "Unknown API route."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))

            if content_length <= 0 or content_length > 1_000_000:
                self._send_json(
                    413,
                    {"error": "Request body must be between 1 byte and 1 MB."}
                )
                return

            payload = json.loads(self.rfile.read(content_length))

            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object.")

            result = interception(
                payload["r0"],
                payload["v0"],
                payload["planet_pos"],
                payload["planet_masses"],
                t0=float(payload["t0"]),
                gravity_scale=float(payload["gravity_scale"]),
                hit_radius=float(payload.get("hit_radius", 15.0)),
                planet_pos_history=payload.get("planet_pos_history"),
                planet_history_dt=float(
                    payload.get("planet_history_dt", 0.25)
                ),
            )

        except (KeyError, TypeError, json.JSONDecodeError, ValueError) as exc:
            self._send_json(422, {"error": str(exc)})
            return

        except Exception:
            logging.exception("Interception request failed")
            self._send_json(
                500,
                {"error": "Interception solver failed; see backend logs."}
            )
            return

        self._send_json(200, result)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    host = "0.0.0.0"
    port = int(os.environ.get("PORT", 8000))

    server = ThreadingHTTPServer((host, port), ApiHandler)

    logging.info("AstroShield Python API listening on %s:%s", host, port)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("Stopping AstroShield Python API")
    finally:
        server.server_close()