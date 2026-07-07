//! Embeds the built SPA bundle into the binary at compile time (spec DESK-01 AC2) -- zero
//! filesystem reads, zero HTTP for app assets. Requires `apps/web/dist` to exist (`pnpm --filter
//! @openfold/web run build`); rust-embed fails the build with a clear "no such directory" error
//! if it's missing, rather than silently shipping an empty binary.

use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../../apps/web/dist"]
pub struct Assets;

pub const PROTOCOL_SCHEME: &str = "openfold";

/// The origin the SPA runs under inside the webview (scheme + host, no trailing slash).
/// IndexedDB is origin-keyed -- changing this string after release silently wipes every user's
/// local history on their next launch (spec DESK-02 AC2/AC3). Treat any change as a breaking
/// data-migration event, never a casual refactor.
pub const ORIGIN: &str = "openfold://app";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origin_and_scheme_are_frozen_at_their_documented_literal_values() {
        // If this test ever needs to change, stop: every existing installation's IndexedDB data
        // becomes unreadable the next time that user's binary is updated. See the ORIGIN doc
        // comment for why, and design.md's DESK-02 discussion for the migration story required
        // before this can ever change.
        assert_eq!(PROTOCOL_SCHEME, "openfold");
        assert_eq!(ORIGIN, "openfold://app");
    }

    #[test]
    fn the_built_spa_bundle_is_actually_embedded() {
        assert!(Assets::get("index.html").is_some(), "apps/web/dist/index.html must exist -- run `pnpm --filter @openfold/web run build` first");
    }
}
