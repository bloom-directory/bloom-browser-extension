# Bloom browser extension

The Chromium extension transports checkout commands to one tab in the person's
existing browser. It uses native messaging and content scripts, without debugger
permission. Its reviewed site allowlist currently covers Aerolíneas and JetSMART.

This repository owns the manifest, background worker, content-script dispatcher,
extension identity and bundle assembly. Bloom checkout supplies the generic DOM
scripts at build time and owns the native host, private browser state, traveler
unlock, payment validation and single submission. Flights search and airline
booking instructions belong in bloom-petal-flights.

Bloom depends on this Rust crate at an exact Git revision. There is no runtime
download, sibling checkout, or separately maintained copy of the DOM scripts.
The installed version hashes both transport assets and supplied scripts.

Run `cargo test`, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check`
and `node --check` on both JavaScript files.

Install with Bloom's `bloom-extension-host install <directory> <checkout-socket>`,
then load that directory as an unpacked extension. This remains a development
installation, not a browser-store release. The checkout daemon and native host
must share a UID; production service-user integration still needs verification.
