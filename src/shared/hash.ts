// cyrb53: a fast, well-distributed 53-bit string hash.
const cyrb53 = (value: string, seed: number): number => {
  let first = 0xdeadbeef ^ seed
  let second = 0x41c6ce57 ^ seed

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 2654435761)
    second = Math.imul(second ^ code, 1597334677)
  }

  first = Math.imul(first ^ (first >>> 16), 2246822507)
  first ^= Math.imul(second ^ (second >>> 13), 3266489909)
  second = Math.imul(second ^ (second >>> 16), 2246822507)
  second ^= Math.imul(first ^ (first >>> 13), 3266489909)

  return 4294967296 * (2097151 & second) + (first >>> 0)
}

// Two seeds give about 106 bits, so ids and checksums practically never collide.
// Not for security: it only needs to be stable and fast.
export const hashString = (value: string): string =>
  cyrb53(value, 1).toString(16).padStart(14, '0') + cyrb53(value, 2).toString(16).padStart(14, '0')
