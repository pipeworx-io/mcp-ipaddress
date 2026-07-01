interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * IP address utilities MCP.
 *
 * Keyless, offline: validate & classify IPv4/IPv6 addresses (private, loopback,
 * link-local, multicast, reserved) and compute IPv4 subnet math from CIDR
 * (network, broadcast, netmask, host range, host count). Pure logic — no API,
 * no key. (IPv6 is validated & classified; full IPv6 subnet math is out of scope.)
 */


function parseV4(ip: string): number[] | null {
  const p = ip.split('.');
  if (p.length !== 4) return null;
  const o = p.map((x) => (/^\d{1,3}$/.test(x) ? +x : -1));
  return o.every((n) => n >= 0 && n <= 255) ? o : null;
}
const v4int = (o: number[]) => (o[0] * 2 ** 24 + o[1] * 2 ** 16 + o[2] * 2 ** 8 + o[3]) >>> 0;
const intV4 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

function classifyV4(o: number[]): string[] {
  const tags: string[] = [];
  if (o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168)) tags.push('private');
  if (o[0] === 127) tags.push('loopback');
  if (o[0] === 169 && o[1] === 254) tags.push('link-local');
  if (o[0] >= 224 && o[0] <= 239) tags.push('multicast');
  if (o[0] >= 240) tags.push('reserved');
  if (o[0] === 0) tags.push('this-network');
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) tags.push('cgnat');
  if (tags.length === 0) tags.push('public');
  return tags;
}

const V6 = /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}|([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}|([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}|([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:)|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/i;
function classifyV6(ip: string): string[] {
  const l = ip.toLowerCase();
  const tags: string[] = [];
  if (l === '::1') tags.push('loopback');
  if (l === '::') tags.push('unspecified');
  if (/^fe[89ab]/.test(l)) tags.push('link-local');
  if (/^f[cd]/.test(l)) tags.push('unique-local');
  if (/^ff/.test(l)) tags.push('multicast');
  if (/^2001:db8/.test(l)) tags.push('documentation');
  if (tags.length === 0) tags.push('global-unicast');
  return tags;
}

const tools: McpToolExport['tools'] = [
  {
    name: 'parse_ip',
    description: 'Validate and classify an IP address (IPv4 or IPv6): version, validity, and classification (private/loopback/link-local/multicast/reserved/public). IPv4 also returns its 32-bit integer. Keyless, offline.',
    inputSchema: { type: 'object', properties: { ip: { type: 'string', description: 'An IPv4 or IPv6 address, e.g. "192.168.1.10" or "2001:db8::1".' } }, required: ['ip'] },
  },
  {
    name: 'cidr_info',
    description: 'Parse an IPv4 CIDR block (e.g. "192.168.1.0/24") and compute the network address, broadcast, netmask, wildcard, usable host range and host count. Keyless, offline.',
    inputSchema: { type: 'object', properties: { cidr: { type: 'string', description: 'An IPv4 CIDR, e.g. "10.0.0.0/8".' } }, required: ['cidr'] },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'parse_ip': {
      const ip = reqStr(args, 'ip', '"192.168.1.10"').trim();
      const o = parseV4(ip);
      if (o) return { input: ip, valid: true, version: 4, integer: v4int(o), classification: classifyV4(o) };
      if (V6.test(ip)) return { input: ip, valid: true, version: 6, classification: classifyV6(ip) };
      return { input: ip, valid: false, reason: 'Not a valid IPv4 or IPv6 address.' };
    }
    case 'cidr_info': {
      const cidr = reqStr(args, 'cidr', '"192.168.1.0/24"').trim();
      const [ipStr, prefStr] = cidr.split('/');
      const o = parseV4(ipStr || '');
      const prefix = /^\d{1,2}$/.test(prefStr || '') ? +prefStr : -1;
      if (!o || prefix < 0 || prefix > 32) return { input: cidr, valid: false, reason: 'Expected an IPv4 CIDR like "192.168.1.0/24" (prefix 0-32).' };
      const ipn = v4int(o);
      const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
      const network = (ipn & mask) >>> 0;
      const broadcast = (network | (~mask >>> 0)) >>> 0;
      const total = 2 ** (32 - prefix);
      const usable = prefix >= 31 ? total : total - 2;
      return {
        input: cidr, valid: true, prefix,
        network: intV4(network), broadcast: intV4(broadcast),
        netmask: intV4(mask), wildcard: intV4(~mask >>> 0),
        first_host: prefix >= 31 ? intV4(network) : intV4((network + 1) >>> 0),
        last_host: prefix >= 31 ? intV4(broadcast) : intV4((broadcast - 1) >>> 0),
        total_addresses: total, usable_hosts: usable,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqStr(args: Record<string, unknown>, key: string, ex: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${ex}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
