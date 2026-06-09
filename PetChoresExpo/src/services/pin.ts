// Salted PIN hashing with expo-crypto (SHA256). The raw PIN is never stored.
import * as Crypto from "expo-crypto";
import { uid } from "./uid";

export function newSalt(): string {
  return (uid() + uid()).replace(/-/g, "");
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + pin);
}

export async function verifyPin(pin: string, salt: string, expected: string): Promise<boolean> {
  const candidate = await hashPin(pin, salt);
  return candidate === expected;
}

export function isValidPinFormat(pin: string): boolean {
  return pin.length === 4 && /^[0-9]{4}$/.test(pin);
}
