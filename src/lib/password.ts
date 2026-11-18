import { hash, verify } from "@node-rs/argon2";
export const hashPassword = (value: string) =>
  hash(value, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (encoded: string, value: string) =>
  verify(encoded, value);
