#!/usr/bin/env node
// Content validation CLI.
// No-op stub until M1.3 implements the full Zod-based content validator (SPEC §3).
// The exit code contract (0 = ok) is established now so CI can wire `npm run validate`.

console.log('validate: no-op stub (full content validation lands in M1.3).');
process.exit(0);
