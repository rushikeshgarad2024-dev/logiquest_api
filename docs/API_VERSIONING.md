# API Versioning & Deprecation Strategy

## Version Matrix

| Endpoint | Version | Status | Deprecation Header | Sunset Date |
| :--- | :--- | :--- | :--- | :--- |
| `GET /` | Neutral | Active | No | N/A |
| `GET /v1/puzzles` | `v1` | **Deprecated** | Yes | `2026-12-31` |
| `GET /v2/puzzles` | `v2` | Active | No | N/A |

## Versioning Rules
1. **URI Prefixing:** All versioned routes are prefixed with `/v{N}/`.
2. **Unversioned Requests:** Default to `/v1/` automatically.
3. **Deprecation Signals:** Deprecated endpoints return HTTP Header `Deprecation: true` and a `deprecation` payload block.