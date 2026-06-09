import Foundation

/// Drives the internal Industry Rolodex backed by film-rolodex.js (Netlify Blobs).
/// All calls require the admin session cookie (see AuthService).
@MainActor
final class RolodexService: ObservableObject {
    @Published var companies: [Company] = []
    @Published var people: [Person] = []
    @Published var facets = Facets()
    @Published var totals = Totals()
    @Published var isLoading = false
    @Published var isPaging = false
    @Published var error: String?
    @Published var hasMore = false
    @Published var working: String?   // label of an in-flight enrich/tool action

    private let api = APIClient.shared
    private let pageSize = 1000
    private var offset = 0

    // Current filter state (so loadMore can repeat it).
    private(set) var query = ""
    private(set) var type = ""
    private(set) var tag = ""
    private(set) var dept = ""

    private let path = "/.netlify/functions/film-rolodex"

    // MARK: - Listing

    func load(query: String = "", type: String = "", tag: String = "", dept: String = "") async {
        self.query = query; self.type = type; self.tag = tag; self.dept = dept
        offset = 0
        isLoading = true; error = nil
        defer { isLoading = false }
        do {
            let resp = try await fetchPage(offset: 0)
            companies = resp.companies ?? []
            people = resp.people ?? []
            if let f = resp.facets { facets = f }
            if let t = resp.total { totals = t }
            hasMore = (resp.paging?.companiesHasMore == true) || (resp.paging?.peopleHasMore == true)
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loadMore() async {
        guard hasMore, !isPaging else { return }
        isPaging = true
        defer { isPaging = false }
        offset += pageSize
        do {
            let resp = try await fetchPage(offset: offset)
            companies += resp.companies ?? []
            people += resp.people ?? []
            hasMore = (resp.paging?.companiesHasMore == true) || (resp.paging?.peopleHasMore == true)
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            offset -= pageSize
        }
    }

    private func fetchPage(offset: Int) async throws -> RolodexListResponse {
        var q: [String: String] = ["action": "list", "limit": String(pageSize), "offset": String(offset)]
        if !query.isEmpty { q["q"] = query }
        if !type.isEmpty { q["type"] = type }
        if !tag.isEmpty { q["tag"] = tag }
        if !dept.isEmpty { q["dept"] = dept }
        return try await api.get(path, query: q)
    }

    // MARK: - Mutations

    struct ActionResult: Decodable { var ok: Bool?; var id: String?; var error: String? }

    func addCompany(_ company: [String: Any]) async throws {
        let r: ActionResult = try await api.post(path, body: ["action": "addCompany", "company": company])
        try ensure(r)
    }

    func addPerson(_ person: [String: Any]) async throws {
        let r: ActionResult = try await api.post(path, body: ["action": "addPerson", "person": person])
        try ensure(r)
    }

    func updateCompany(id: String, patch: [String: Any]) async throws {
        let r: ActionResult = try await api.post(path, body: ["action": "updateCompany", "id": id, "patch": patch])
        try ensure(r)
    }

    func updatePerson(id: String, patch: [String: Any]) async throws {
        let r: ActionResult = try await api.post(path, body: ["action": "updatePerson", "id": id, "patch": patch])
        try ensure(r)
    }

    func deleteCompany(id: String) async throws {
        let r: ActionResult = try await api.post(path, body: ["action": "deleteCompany", "id": id])
        try ensure(r)
        companies.removeAll { $0.id == id }
    }

    func deletePerson(id: String) async throws {
        let r: ActionResult = try await api.post(path, body: ["action": "deletePerson", "id": id])
        try ensure(r)
        people.removeAll { $0.id == id }
    }

    private func ensure(_ r: ActionResult) throws {
        if r.ok != true { throw APIError.transport(r.error ?? "Action failed.") }
    }

    // MARK: - Enrichment (per contact)

    /// Returns a short human-readable summary of what the enrich call found.
    func enrichPerson(id: String) async -> String {
        await runTool("Finding email") {
            let data = try await self.api.rawPOST(self.path, body: ["action": "enrich", "personId": id])
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            if let person = obj["person"] as? [String: Any], let updated = self.reDecodePerson(person) {
                self.replace(person: updated)
            }
            let found = (obj["found"] as? [Any])?.count ?? 0
            let verified = obj["verified"] as? Bool ?? false
            return found > 0 ? "Found \(found) candidate email\(found == 1 ? "" : "s")\(verified ? ", verified" : "")." : "No new email found."
        }
    }

    func enrichCompany(id: String) async -> String {
        await runTool("Finding emails") {
            let data = try await self.api.rawPOST(self.path, body: ["action": "enrich-company", "companyId": id])
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            if let company = obj["company"] as? [String: Any], let updated = self.reDecodeCompany(company) {
                self.replace(company: updated)
            }
            let saved = (obj["saved"] as? [String: Any])?["addedEmails"] as? Int
            let found = (obj["found"] as? [Any])?.count ?? saved ?? 0
            return found > 0 ? "Added \(found) email\(found == 1 ? "" : "s") to this company." : "No new company emails found."
        }
    }

    func findNewestEmail(id: String) async -> String {
        await runTool("Finding newest email") {
            let data = try await self.api.rawPOST(self.path, body: ["action": "find-newest-email", "personId": id])
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            if let person = obj["person"] as? [String: Any], let updated = self.reDecodePerson(person) {
                self.replace(person: updated)
            }
            if let employer = obj["employer"] as? String, !employer.isEmpty {
                return "Detected current employer: \(employer)."
            }
            return (obj["ok"] as? Bool == true) ? "Refreshed from latest credits." : "No newer email detected."
        }
    }

    // MARK: - Bulk tools

    func syncNow() async -> String {
        await runTool("Syncing") {
            _ = try await self.api.rawPOST("/.netlify/functions/film-rolodex-cron", body: [:])
            return "Sync started. Pull to refresh in a moment."
        }
    }

    func deepCrawl() async -> String {
        await runTool("Deep crawling") {
            _ = try await self.api.rawPOST("/.netlify/functions/film-rolodex-deep-cron", body: [:])
            return "Deep crawl started. This runs in the background."
        }
    }

    func freshenStale() async -> String {
        await runTool("Freshening stale emails") {
            let data = try await self.api.rawPOST(self.path, body: ["action": "freshen-batch"])
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            let remaining = obj["remaining"] as? Int
            return remaining != nil ? "Freshened a batch. ~\(remaining!) stale contacts remaining." : "Freshen batch complete."
        }
    }

    // MARK: - Helpers

    private func runTool(_ label: String, _ op: @escaping () async throws -> String) async -> String {
        working = label
        defer { working = nil }
        do { return try await op() }
        catch { return (error as? APIError)?.errorDescription ?? error.localizedDescription }
    }

    private func replace(person: Person) {
        if let i = people.firstIndex(where: { $0.id == person.id }) { people[i] = person }
    }
    private func replace(company: Company) {
        if let i = companies.firstIndex(where: { $0.id == company.id }) { companies[i] = company }
    }

    private func reDecodePerson(_ dict: [String: Any]) -> Person? {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return try? JSONDecoder().decode(Person.self, from: data)
    }
    private func reDecodeCompany(_ dict: [String: Any]) -> Company? {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return try? JSONDecoder().decode(Company.self, from: data)
    }
}
