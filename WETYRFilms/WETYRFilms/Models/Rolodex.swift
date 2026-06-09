import Foundation

/// Response from netlify/functions/film-rolodex.js ?action=list
struct RolodexListResponse: Decodable {
    var ok: Bool?
    var companies: [Company]?
    var people: [Person]?
    var paging: Paging?
    var total: Totals?
    var facets: Facets?
}

struct Paging: Decodable, Hashable {
    var limit: Int?
    var offset: Int?
    var companiesReturned: Int?
    var peopleReturned: Int?
    var companiesHasMore: Bool?
    var peopleHasMore: Bool?
}

struct Totals: Decodable, Hashable {
    var companies: Int?
    var people: Int?
    var filteredCompanies: Int?
    var filteredPeople: Int?
}

struct Facets: Decodable, Hashable {
    var types: [String]?
    var tags: [String]?
    var depts: [String]?
}

// MARK: - Company

struct Company: Decodable, Identifiable, Hashable {
    var id: String
    var name: String
    var type: String?
    var parent: String?
    var hq: String?
    var website: String?
    var phone: String?
    var phoneSecondary: String?
    var phones: [String]?
    var emails: [EmailEntry]?
    var imdb: String?
    var secCik: String?
    var productions: [String]?
    var notes: String?
    var tags: [String]?

    enum CodingKeys: String, CodingKey {
        case id, name, type, parent, hq, website, phone
        case phoneSecondary = "phone_secondary"
        case phones, emails, imdb
        case secCik = "sec_cik"
        case productions, notes, tags
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        name = (try? c.decode(String.self, forKey: .name)) ?? "Unnamed company"
        type = try? c.decodeIfPresent(String.self, forKey: .type)
        parent = try? c.decodeIfPresent(String.self, forKey: .parent)
        hq = try? c.decodeIfPresent(String.self, forKey: .hq)
        website = try? c.decodeIfPresent(String.self, forKey: .website)
        phone = try? c.decodeIfPresent(String.self, forKey: .phone)
        phoneSecondary = try? c.decodeIfPresent(String.self, forKey: .phoneSecondary)
        phones = try? c.decodeIfPresent([String].self, forKey: .phones)
        emails = try? c.decodeIfPresent([EmailEntry].self, forKey: .emails)
        imdb = try? c.decodeIfPresent(String.self, forKey: .imdb)
        secCik = LooseString.decode(c, .secCik)
        productions = try? c.decodeIfPresent([String].self, forKey: .productions)
        notes = try? c.decodeIfPresent(String.self, forKey: .notes)
        tags = try? c.decodeIfPresent([String].self, forKey: .tags)
    }

    /// De-duplicated phone list (phones[] plus the singletons).
    var allPhones: [String] {
        var list = phones ?? []
        if let phone { list.append(phone) }
        if let phoneSecondary { list.append(phoneSecondary) }
        var seen = Set<String>(); var out: [String] = []
        for p in list {
            let key = p.filter(\.isNumber)
            if key.isEmpty || seen.contains(key) { continue }
            seen.insert(key); out.append(p)
        }
        return Array(out.prefix(4))
    }
}

// MARK: - Person

struct Person: Decodable, Identifiable, Hashable {
    var id: String
    var name: String
    var title: String?
    var dept: String?
    var companyId: String?
    var companyName: String?      // _companyName, attached server-side
    var companyType: String?      // _companyType
    var email: String?
    var emails: [EmailEntry]?
    var phone: String?
    var linkedin: String?
    var imdb: String?
    var productions: [String]?
    var notes: String?
    var tags: [String]?
    var primaryEmail: String?     // _primaryEmail

    enum CodingKeys: String, CodingKey {
        case id, name, title, dept
        case companyId = "company_id"
        case companyName = "_companyName"
        case companyType = "_companyType"
        case email, emails, phone, linkedin, imdb, productions, notes, tags
        case primaryEmail = "_primaryEmail"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        name = (try? c.decode(String.self, forKey: .name)) ?? "Unnamed contact"
        title = try? c.decodeIfPresent(String.self, forKey: .title)
        dept = try? c.decodeIfPresent(String.self, forKey: .dept)
        companyId = try? c.decodeIfPresent(String.self, forKey: .companyId)
        companyName = try? c.decodeIfPresent(String.self, forKey: .companyName)
        companyType = try? c.decodeIfPresent(String.self, forKey: .companyType)
        email = try? c.decodeIfPresent(String.self, forKey: .email)
        emails = try? c.decodeIfPresent([EmailEntry].self, forKey: .emails)
        phone = try? c.decodeIfPresent(String.self, forKey: .phone)
        linkedin = try? c.decodeIfPresent(String.self, forKey: .linkedin)
        imdb = try? c.decodeIfPresent(String.self, forKey: .imdb)
        productions = try? c.decodeIfPresent([String].self, forKey: .productions)
        notes = try? c.decodeIfPresent(String.self, forKey: .notes)
        tags = try? c.decodeIfPresent([String].self, forKey: .tags)
        primaryEmail = try? c.decodeIfPresent(String.self, forKey: .primaryEmail)
    }

    /// Normalized email list, de-duplicated, current first, archived last.
    var emailList: [EmailEntry] {
        var list = emails ?? []
        if list.isEmpty, let email { list = [EmailEntry(address: email, source: "manual")] }
        var seen = Set<String>(); var out: [EmailEntry] = []
        for e in list {
            let a = e.address.lowercased()
            if a.isEmpty || seen.contains(a) { continue }
            seen.insert(a); out.append(e)
        }
        return out.sorted { a, b in
            if a.isArchived != b.isArchived { return !a.isArchived }
            return (a.freshness ?? 0) > (b.freshness ?? 0)
        }
    }

    var subtitle: String {
        var parts: [String] = []
        if let t = title ?? dept, !t.isEmpty { parts.append(t) }
        if let cn = companyName, !cn.isEmpty { parts.append(cn) }
        return parts.joined(separator: " . ")
    }
}

// MARK: - Email entry (string OR rich object)

struct EmailEntry: Decodable, Hashable, Identifiable {
    var address: String
    var source: String?
    var score: Double?
    var freshness: Double?       // _freshness 0-200
    var isPrimary: Bool?         // _isPrimary
    var archivedAt: String?      // _archivedAt
    var archivedReason: String?  // _archivedReason
    var freshnessReasons: [String]?  // _freshnessReasons

    var id: String { address.lowercased() }
    var isArchived: Bool { archivedAt != nil && !(archivedAt ?? "").isEmpty }

    init(address: String, source: String? = nil) {
        self.address = address
        self.source = source
    }

    enum CodingKeys: String, CodingKey {
        case address, source, score
        case freshness = "_freshness"
        case isPrimary = "_isPrimary"
        case archivedAt = "_archivedAt"
        case archivedReason = "_archivedReason"
        case freshnessReasons = "_freshnessReasons"
    }

    init(from decoder: Decoder) throws {
        // The API ships emails as either a bare string or a rich object.
        if let single = try? decoder.singleValueContainer(), let str = try? single.decode(String.self) {
            address = str
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        address = (try? c.decode(String.self, forKey: .address)) ?? ""
        source = try? c.decodeIfPresent(String.self, forKey: .source)
        score = try? c.decodeIfPresent(Double.self, forKey: .score)
        freshness = try? c.decodeIfPresent(Double.self, forKey: .freshness)
        isPrimary = try? c.decodeIfPresent(Bool.self, forKey: .isPrimary)
        archivedAt = try? c.decodeIfPresent(String.self, forKey: .archivedAt)
        archivedReason = try? c.decodeIfPresent(String.self, forKey: .archivedReason)
        freshnessReasons = try? c.decodeIfPresent([String].self, forKey: .freshnessReasons)
    }

    /// Freshness band label + color band index (mirrors the web badges).
    enum Band: String { case current = "CURRENT", likely = "LIKELY", aging = "AGING", old = "OLD", stale = "STALE" }
    var band: Band? {
        guard let f = freshness else { return nil }
        switch f {
        case 130...: return .current
        case 90..<130: return .likely
        case 60..<90: return .aging
        case 30..<60: return .old
        default: return .stale
        }
    }
}

// MARK: - Loose string decoding helper (accepts String, Int, or Double)

enum LooseString {
    static func decode<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> String? {
        if let s = try? c.decodeIfPresent(String.self, forKey: key), let s { return s }
        if let i = try? c.decodeIfPresent(Int.self, forKey: key), let i { return String(i) }
        if let d = try? c.decodeIfPresent(Double.self, forKey: key), let d {
            return d == d.rounded() ? String(Int(d)) : String(d)
        }
        return nil
    }
}
