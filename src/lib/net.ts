// Minimal CIDR/IP matching utilities (IPv4 only)
function ipToInt(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const p = Number(parts[i]);
    if (Number.isNaN(p) || p < 0 || p > 255) return null;
    num = (num << 8) + p;
  }
  return num >>> 0;
}

export function isIpInCidr(ip: string, cidrOrIp: string): boolean {
  // Exact match
  if (!cidrOrIp.includes("/")) {
    return ip === cidrOrIp;
  }
  const [net, bitsStr] = cidrOrIp.split("/");
  const bits = Number(bitsStr);
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipToInt(ip);
  const netInt = ipToInt(net);
  if (ipInt === null || netInt === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

export function ipMatchesAny(ip: string, list: string[] | undefined | null) {
  if (!Array.isArray(list) || list.length === 0) return false;
  for (const entry of list) {
    if (isIpInCidr(ip, entry)) return true;
  }
  return false;
}

export default { isIpInCidr, ipMatchesAny };
