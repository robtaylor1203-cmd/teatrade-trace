// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  TeaTrade Trace · AnchorRegistry
/// @notice Minimal append-only registry for proving that a given hash
///         was published by the TeaTrade Trace platform at a specific
///         block in time. Storage is intentionally NOT persisted — we
///         emit an event per anchor and rely on the chain's permanent
///         event log. This keeps gas at ~50–60k per call.
/// @dev    Two anchor kinds:
///           kind=0  →  per-lot head hash (instant finality at mint)
///           kind=1  →  daily Merkle root (covers all events that day)
contract AnchorRegistry {
    /// @notice Emitted on every successful anchor.
    /// @param  hash         The bytes32 payload anchored on-chain.
    /// @param  kind         0 = head, 1 = daily-root.
    /// @param  reference    Optional context string (e.g. lot id).
    /// @param  anchorer     msg.sender (the platform key).
    event Anchored(
        bytes32 indexed hash,
        uint8   indexed kind,
        string  reference,
        address indexed anchorer
    );

    /// @notice Anchor a hash on-chain.
    /// @param  hash       The 32-byte hash to publish.
    /// @param  kind       0 = head, 1 = daily-root.
    /// @param  reference  Free-text context (lot id, ISO date, etc.).
    function anchor(bytes32 hash, uint8 kind, string calldata reference) external {
        require(hash != bytes32(0), "AnchorRegistry: empty hash");
        require(kind <= 1, "AnchorRegistry: bad kind");
        emit Anchored(hash, kind, reference, msg.sender);
    }

    /// @notice Convenience: anchor several head hashes in a single tx.
    function anchorBatch(
        bytes32[] calldata hashes,
        string[]  calldata references
    ) external {
        require(hashes.length == references.length, "AnchorRegistry: length mismatch");
        for (uint256 i = 0; i < hashes.length; i++) {
            require(hashes[i] != bytes32(0), "AnchorRegistry: empty hash");
            emit Anchored(hashes[i], 0, references[i], msg.sender);
        }
    }
}
