"""
Faces for Lignée (faces.js): finds the faces of images and describes each one, on this computer.

    python faces-worker.py <detector.onnx> <recognizer.onnx> <image>...

Writes one line per image on stdout, in order: {"faces": [{"box": [x, y, w, h], "score": s,
"vec": [128 numbers]}]} with the box in fractions of the image, or {"error": "..."} if the image
can't be read. Two faces are the same person when their vectors are close (cosine, see faces.js).

The models come from OpenCV's model zoo: YuNet finds the faces, SFace describes them.
"""
import json
import sys

import cv2
import numpy as np

MIN_SCORE = 0.8  # below, YuNet mostly finds patterns of a dress or a wall
MAX_SIDE = 2000  # larger images are reduced first: same faces, much faster


def read(path):
    """The image at `path` (any name, even with accents on Windows), in colour, or None."""
    data = np.fromfile(path, dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR) if data.size else None
    if img is None:
        return None
    h, w = img.shape[:2]
    if max(h, w) > MAX_SIDE:
        k = MAX_SIDE / max(h, w)
        img = cv2.resize(img, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA)
    return img


def faces_of(img, detector, recognizer):
    h, w = img.shape[:2]
    detector.setInputSize((w, h))
    _, found = detector.detect(img)
    out = []
    for f in found if found is not None else []:
        score = float(f[-1])
        if score < MIN_SCORE:
            continue
        vec = recognizer.feature(recognizer.alignCrop(img, f)).flatten()
        x, y, fw, fh = (float(v) for v in f[:4])
        x0, y0 = max(0.0, x), max(0.0, y)
        box = [x0 / w, y0 / h, (min(w, x + fw) - x0) / w, (min(h, y + fh) - y0) / h]
        out.append({
            "box": [round(v, 4) for v in box],
            "score": round(score, 3),
            "vec": [round(float(v), 5) for v in vec],
        })
    return out


def main():
    if len(sys.argv) < 3:
        sys.exit("usage: faces-worker.py <detector.onnx> <recognizer.onnx> <image>...")
    detector = cv2.FaceDetectorYN.create(sys.argv[1], "", (320, 320), MIN_SCORE, 0.3, 5000)
    recognizer = cv2.FaceRecognizerSF.create(sys.argv[2], "")
    for path in sys.argv[3:]:
        try:
            img = read(path)
            line = {"faces": faces_of(img, detector, recognizer)} if img is not None else {"error": "unreadable image"}
        except Exception as e:  # one bad image must not stop the others
            line = {"error": str(e)}
        print(json.dumps(line), flush=True)


if __name__ == "__main__":
    main()
