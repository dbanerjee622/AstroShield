import serial
import time

PORT = "COM5"  # Replace COM5 with your actual port

board = serial.Serial(PORT, 9600, timeout=1)
time.sleep(2)  # Allow the board to initialize

try:
    print("Red LED on...")
    board.write(b"1\n")
    board.flush()
    time.sleep(2)

    print("Green LED on...")
    board.write(b"0\n")
    board.flush()
    time.sleep(2)

finally:
    board.close()
    print("Test finished.")
