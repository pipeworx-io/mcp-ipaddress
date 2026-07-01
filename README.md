# mcp-ipaddress

IP address utilities MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1170+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `parse_ip` | Validate and classify an IP address (IPv4 or IPv6): version, validity, and classification (private/loopback/link-local/multicast/reserved/public). IPv4 also returns its 32-bit integer. Keyless, offline. |
| `cidr_info` | Parse an IPv4 CIDR block (e.g. "192.168.1.0/24") and compute the network address, broadcast, netmask, wildcard, usable host range and host count. Keyless, offline. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "ipaddress": {
      "url": "https://gateway.pipeworx.io/ipaddress/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1170+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Ipaddress data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [All tools and guides](https://github.com/pipeworx-io/examples)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
