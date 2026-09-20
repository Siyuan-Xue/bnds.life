// RFC 6381 / ISO 14496-15 codec strings, read from avcC / hvcC bytes.
export function mp4VideoCodec(codec, bytes) {
  if (bytes[0] !== 1) throw new Error("缺少有效的 MP4 解码配置");
  if (codec === "h264" && bytes.length >= 4)
    return `avc1.${bytes.subarray(1, 4).toString("hex").toUpperCase()}`;
  if (codec !== "hevc" || bytes.length < 13)
    throw new Error("不支持的 MP4 解码配置");
  const profile = `${["", "A", "B", "C"][bytes[1] >> 6]}${bytes[1] & 31}`;
  let flags = bytes.readUInt32BE(2),
    reversed = 0;
  for (let bit = 0; bit < 32; bit++) {
    reversed = (reversed << 1) | (flags & 1);
    flags >>>= 1;
  }
  const constraints = Array.from(bytes.subarray(6, 12));
  while (constraints.length > 1 && constraints.at(-1) === 0) constraints.pop();
  return `hvc1.${profile}.${(reversed >>> 0).toString(16).toUpperCase()}.${bytes[1] & 32 ? "H" : "L"}${bytes[12]}.${constraints.map((b) => b.toString(16).toUpperCase()).join(".")}`;
}
