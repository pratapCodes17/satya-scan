function errorName(reason: unknown) {
  if (typeof reason === "object" && reason !== null && "name" in reason && typeof reason.name === "string") return reason.name;
  return "";
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "";
}

export function cameraFallbackMessage(reason: unknown) {
  const name = errorName(reason);
  const message = errorMessage(reason);
  if (message === "camera-timeout") return "Camera access did not respond. Use Upload image to select a photo instead.";
  if (message === "preview-unavailable") return "Camera preview was unavailable. Use Upload image to select a photo instead.";
  if (name === "NotAllowedError") return "Camera permission was not granted. Use Upload image to select a photo instead.";
  if (name === "NotFoundError") return "No usable device camera was found. Use Upload image to select a photo instead.";
  if (name === "NotSupportedError") return "Live camera is not supported in this browser. Use Upload image to select a photo instead.";
  return "Camera access is unavailable. Use Upload image to select a photo instead.";
}
