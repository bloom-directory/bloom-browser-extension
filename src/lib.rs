//! Browser transport assets. Checkout supplies its reviewed page scripts;
//! custody, approvals, payment validation and native messaging stay in checkout.
use sha2::{Digest, Sha256};

pub const HOST_NAME: &str = "directory.bloom.checkout";
pub const EXTENSION_ID: &str = "ngpolgaijmajlonmjmcndcjajgnfcpom";
pub const MANIFEST: &str = include_str!("../extension/manifest.json");
const BACKGROUND: &str = include_str!("../extension/background.js");
const PAGE: &str = include_str!("../extension/page.js");

/// Version both the transport and the checkout scripts it will execute.
pub fn version(scripts: &[(&str, String)]) -> String {
    let mut hash = Sha256::new();
    for part in [MANIFEST, BACKGROUND, PAGE].into_iter().chain(
        scripts
            .iter()
            .flat_map(|(name, source)| [*name, source.as_str()]),
    ) {
        hash.update((part.len() as u64).to_le_bytes());
        hash.update(part.as_bytes());
    }
    format!("{:x}", hash.finalize())
}

pub fn bundle(scripts: &[(&str, String)]) -> Vec<(&'static str, String)> {
    let mut page = String::from(
        "const BLOOM_SCRIPTS = (() => {\n\
         const setTimeout = (done, ms = 0) => { const end = performance.now() + ms; const channel = new MessageChannel(); channel.port1.onmessage = () => performance.now() >= end ? done() : channel.port2.postMessage(0); channel.port2.postMessage(0); };\n\
         return {\n",
    );
    for (name, source) in scripts {
        page.push_str(&format!("{name}: {source},\n"));
    }
    page.push_str("};\n})();\n");
    page.push_str(PAGE);
    vec![
        ("manifest.json", MANIFEST.into()),
        (
            "background.js",
            format!(
                "const BLOOM_VERSION = '{}';\n{BACKGROUND}",
                version(scripts)
            ),
        ),
        ("page.js", page),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    #[test]
    fn identity_matches_manifest() {
        let manifest: serde_json::Value = serde_json::from_str(MANIFEST).unwrap();
        let key = base64::engine::general_purpose::STANDARD
            .decode(manifest["key"].as_str().unwrap())
            .unwrap();
        let digest = Sha256::digest(key);
        let id: String = digest[..16]
            .iter()
            .flat_map(|b| [b >> 4, b & 15])
            .map(|n| (b'a' + n) as char)
            .collect();
        assert_eq!(id, EXTENSION_ID);
    }

    #[test]
    fn checkout_scripts_change_the_installed_version() {
        let first = [("snapshot", "() => 1".to_owned())];
        let second = [("snapshot", "() => 2".to_owned())];
        assert_ne!(version(&first), version(&second));
        assert!(bundle(&first)[2].1.contains("snapshot: () => 1,"));
        assert!(bundle(&second)[1].1.contains(&version(&second)));
    }
}
