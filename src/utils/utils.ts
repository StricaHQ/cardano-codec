import { blake2b } from "blakejs";

export const createHash32 = (buffer: Buffer) => {
  const hash = blake2b(buffer, undefined, 32);
  return Buffer.from(hash).toString("hex");
};

export const createHash28 = (buffer: Buffer) => {
  const hash = blake2b(buffer, undefined, 28);
  return Buffer.from(hash).toString("hex");
};
export const createHash20 = (buffer: Buffer) => {
  const hash = blake2b(buffer, undefined, 20);
  return Buffer.from(hash).toString("hex");
};

export const getCborSpanBuffer = (cborBuff: Buffer, chunk: any): Buffer => {
  const span = chunk.getByteSpan();
  return cborBuff.subarray(span[0], span[1]);
};
