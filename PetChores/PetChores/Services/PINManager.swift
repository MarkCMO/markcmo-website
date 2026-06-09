import Foundation
import CryptoKit

/// Salted hashing for the parent PIN (Section 3.8, Section 13). The raw PIN is never
/// stored; we keep a random per-install salt and the SHA256 of salt + PIN.
enum PINManager {

    /// Generate a fresh random salt as a hex string.
    static func newSalt() -> String {
        var bytes = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    /// Hash a PIN with a salt.
    static func hash(pin: String, salt: String) -> String {
        let input = Data((salt + pin).utf8)
        let digest = SHA256.hash(data: input)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /// Constant-time-ish comparison of a candidate PIN against a stored hash.
    static func verify(pin: String, salt: String, expectedHash: String) -> Bool {
        let candidate = hash(pin: pin, salt: salt)
        // Length guard then compare; the hashes are fixed length hex.
        guard candidate.count == expectedHash.count else { return false }
        var equal = true
        for (a, b) in zip(candidate, expectedHash) where a != b { equal = false }
        return equal
    }

    /// Validate a candidate PIN format: exactly 4 digits (Section 5, Screen 3).
    static func isValidFormat(_ pin: String) -> Bool {
        pin.count == 4 && pin.allSatisfy { $0.isNumber }
    }
}
