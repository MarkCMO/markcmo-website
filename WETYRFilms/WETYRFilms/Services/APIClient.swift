import Foundation

enum APIError: LocalizedError {
    case badURL
    case http(Int, String?)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Could not build the request URL."
        case .http(let code, let msg):
            if code == 401 { return "Not authorized. Please sign in again." }
            return msg ?? "Request failed (HTTP \(code))."
        case .decoding(let m): return "Could not read the response. \(m)"
        case .transport(let m): return m
        }
    }
}

/// Thin async wrapper over the Netlify Functions backend that powers
/// markcmo.com/wetyr-films. Uses the shared URLSession so the HttpOnly
/// `mcadmin_session` cookie set by admin-auth.js is stored and replayed
/// automatically (HTTPCookieStorage persists it for the 7-day lifetime).
struct APIClient {
    static let shared = APIClient()

    private let session: URLSession

    init() {
        let cfg = URLSessionConfiguration.default
        cfg.httpCookieStorage = HTTPCookieStorage.shared
        cfg.httpCookieAcceptPolicy = .always
        cfg.httpShouldSetCookies = true
        cfg.requestCachePolicy = .reloadIgnoringLocalCacheData
        cfg.timeoutIntervalForRequest = 30
        session = URLSession(configuration: cfg)
    }

    /// Configurable so the app can be pointed at a local Netlify dev server.
    var baseURL: URL {
        let stored = UserDefaults.standard.string(forKey: "api_base")
        return URL(string: stored ?? "https://markcmo.com")!
    }

    private var decoder: JSONDecoder { JSONDecoder() }

    // MARK: - GET

    func get<T: Decodable>(_ path: String, query: [String: String] = [:], as type: T.Type = T.self) async throws -> T {
        let data = try await rawGET(path, query: query)
        do { return try decoder.decode(T.self, from: data) }
        catch { throw APIError.decoding(error.localizedDescription) }
    }

    func rawGET(_ path: String, query: [String: String] = [:]) async throws -> Data {
        let base = baseURL.absoluteString.hasSuffix("/")
            ? String(baseURL.absoluteString.dropLast()) : baseURL.absoluteString
        guard var comps = URLComponents(string: base + path) else { throw APIError.badURL }
        if !query.isEmpty {
            comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = comps.url else { throw APIError.badURL }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await perform(req)
    }

    // MARK: - POST (JSON)

    func post<T: Decodable>(_ path: String, body: [String: Any], as type: T.Type = T.self) async throws -> T {
        let data = try await rawPOST(path, body: body)
        do { return try decoder.decode(T.self, from: data) }
        catch { throw APIError.decoding(error.localizedDescription) }
    }

    @discardableResult
    func rawPOST(_ path: String, body: [String: Any]) async throws -> Data {
        let base = baseURL.absoluteString.hasSuffix("/")
            ? String(baseURL.absoluteString.dropLast()) : baseURL.absoluteString
        guard let url = URL(string: base + path) else { throw APIError.badURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await perform(req)
    }

    // MARK: - Core

    private func perform(_ req: URLRequest) async throws -> Data {
        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else {
                throw APIError.transport("No response from server.")
            }
            guard (200..<300).contains(http.statusCode) else {
                let msg = String(data: data, encoding: .utf8)
                throw APIError.http(http.statusCode, serverMessage(from: data) ?? msg)
            }
            return data
        } catch let e as APIError {
            throw e
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
    }

    /// Pull a friendly { error } / { reason } message out of a JSON error body.
    private func serverMessage(from data: Data) -> String? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return (obj["error"] as? String) ?? (obj["reason"] as? String) ?? (obj["message"] as? String)
    }
}
