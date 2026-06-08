/**
 * Test setup: silence jsdom's "Not implemented: HTMLCanvasElement.getContext"
 * noise. The ambient graphics layer feature-detects a 2D context and runs fully
 * inert without one (exactly the jsdom case), so returning null keeps the test
 * output clean while still exercising that inert path.
 */
if (typeof HTMLCanvasElement !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HTMLCanvasElement.prototype as any).getContext = () => null;
}
