import Foundation

/// Owns the admin session state for the Rolodex. Talks to admin-auth.js which
/// sets an HttpOnly `mcadmin_session` cookie that URLSession stores and replays.
@MainActor
final class AuthService: ObservableObject {
    @Published var isAuthed = false
    @Published var isChecking = false
    @Published var lastError: String?

    private let api = APIClient.shared

    /// Verify the persisted cookie on launch / on demand.
    func verify() async {
        isChecking = true
        defer { isChecking = false }
        do {
            struct Verify: Decodable { var ok: Bool? }
            let v: Verify = try await api.get("/.netlify/functions/admin-auth", query: ["action": "verify"])
            isAuthed = (v.ok == true)
        } catch {
            isAuthed = false
        }
    }

    func login(user: String, pass: String) async -> Bool {
        lastError = nil
        do {
            struct LoginResp: Decodable { var ok: Bool?; var error: String? }
            let r: LoginResp = try await api.post("/.netlify/functions/admin-auth", body: ["user": user, "pass": pass])
            if r.ok == true {
                isAuthed = true
                return true
            }
            lastError = r.error ?? "Invalid credentials"
            return false
        } catch {
            lastError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            return false
        }
    }

    func logout() async {
        struct Empty: Decodable {}
        _ = try? await api.post("/.netlify/functions/admin-auth", body: ["action": "logout"], as: Empty.self)
        // Best-effort clear of the locally stored cookie too.
        if let cookies = HTTPCookieStorage.shared.cookies {
            for c in cookies where c.name == "mcadmin_session" {
                HTTPCookieStorage.shared.deleteCookie(c)
            }
        }
        isAuthed = false
    }
}
