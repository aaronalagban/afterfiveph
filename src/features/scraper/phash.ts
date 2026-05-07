import crypto from "crypto";
import { logger } from "../../lib/logger";

/**
 * Difference hash (dHash) — fast 64-bit perceptual fingerprint.
 *
 * Requires `sharp` for image preprocessing.
 * Install: npm install sharp
 * Falls back to SHA-256 content hash when sharp is unavailable.
 */
export async function generateImageHash(buffer: Buffer): Promise<string> {
  try {
    const sharpMod = await import("sharp").catch(() => null);
    if (!sharpMod) {
      logger.warn("[pHash] sharp not installed — using SHA-256 content hash as fallback");
      return crypto.createHash("sha256").update(buffer).digest("hex");
    }

    const sharp = sharpMod.default;

    // dHash: resize to 9 × 8, compare each pixel to its right neighbour → 64 bits
    const { data } = await sharp(buffer)
      .resize(9, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let bits = "";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        bits += data[row * 9 + col] < data[row * 9 + col + 1] ? "1" : "0";
      }
    }

    // Pack 64 bits → 16 hex characters
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch (error) {
    logger.warn(`[pHash] dHash failed — using SHA-256 fallback: ${error}`);
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }
}

/** Hamming distance between two equal-length hex hash strings. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    // Count set bits in a nibble (0–15)
    dist += [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4][xor];
  }
  return dist;
}

/** Two hashes are considered the same flyer when distance ≤ 10 (~84% similar). */
export function isNearDuplicate(a: string, b: string): boolean {
  return hammingDistance(a, b) <= 10;
}
