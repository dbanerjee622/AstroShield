import json
import logging
import threading
import time
import serial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from trajectory import interception

SERIAL_PORT = "COM5"
BAUD_RATE = 9600

led_board = None
led_lock = threading.Lock()


def connect_leds():
    global led_board

    try:
        led_board = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)
        logging.info("Connected to LED controller on %s", SERIAL_PORT)
        update_leds(False)
    except serial.SerialException:
        logging.exception("Could not connect to LED controller on %s", SERIAL_PORT)
        led_board = None


def update_leds(will_hit):
    if led_board is None:
        return

    command = b"1" if will_hit else b"0"

    try:
        with led_lock:
            led_board.write(command)
            led_board.flush()

        logging.info(
            "LED command sent: %s",
            "RED" if will_hit else "GREEN"
        )
    except serial.SerialException:
        logging.exception("Failed to update LEDs")


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

            logging.info(
                "Collision prediction: willHit=%s, closestApproach=%s",
                result.get("willHit"),
                result.get("closestApproach"),
            )

            update_leds(bool(result["willHit"]))

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
    connect_leds()

    server = ThreadingHTTPServer(
        ("127.0.0.1", 8000),
        ApiHandler
    )

    logging.info(
        "AstroShield Python API listening on http://127.0.0.1:8000"
    )

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("Stopping AstroShield Python API")
    finally:
        server.server_close()
        if led_board is not None and led_board.is_open:
            led_board.close()
            logging.info("LED controller connection closed")
