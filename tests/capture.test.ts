import assert from "node:assert/strict";
import test from "node:test";
import { MAX_IMAGE_BYTES, prepareImage } from "../lib/image";
import { cameraFallbackMessage } from "../lib/camera";

test("image selection rejects unsupported formats, oversized images and invalid image bytes before OCR", async () => {
  await assert.rejects(
    prepareImage(new File(["plain text"], "label.txt", { type: "text/plain" })),
    /JPG, PNG, JPEG, or WebP/,
  );
  await assert.rejects(
    prepareImage(new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "large.png", { type: "image/png" })),
    /smaller than 10 MB/,
  );
  await assert.rejects(
    prepareImage(new File(["not an image"], "label.png", { type: "image/png" })),
    /not a readable supported image/,
  );
});

test("camera fallback messages keep upload available for permissions, missing hardware and timeouts", () => {
  assert.match(cameraFallbackMessage({ name: "NotAllowedError" }), /permission was not granted/);
  assert.match(cameraFallbackMessage({ name: "NotFoundError" }), /No usable device camera/);
  assert.match(cameraFallbackMessage(new Error("camera-timeout")), /did not respond/);
  assert.match(cameraFallbackMessage(new Error("preview-unavailable")), /preview was unavailable/);
});
