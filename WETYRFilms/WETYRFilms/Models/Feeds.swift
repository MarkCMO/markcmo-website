import Foundation

// MARK: - Industry News (netlify/functions/news-feed.js)

struct NewsResponse: Decodable {
    var fetchedAt: String?
    var sourceCount: Int?
    var sourcesOk: Int?
    var items: [NewsItem]?
}

struct NewsItem: Decodable, Identifiable, Hashable {
    var src: String?
    var title: String
    var link: String
    var author: String?
    var date: String?

    var id: String { link }
}

// MARK: - Casting Calls (netlify/functions/casting-calls.js)

struct CastingResponse: Decodable {
    var scripted: [CastingCall]?
    var commercial: [CastingCall]?
    var fetchedAt: String?
    var sourcesOk: Int?
    var sourceCount: Int?
}

struct CastingCall: Decodable, Identifiable, Hashable {
    var source: String?
    var sourceSlug: String?
    var title: String
    var link: String
    var summary: String?
    var date: String?
    var location: String?
    var role: String?
    var rate: String?
    var union: Bool?
    var unpaid: Bool?
    var category: String?
    var tags: [String]?

    var id: String { link }
}

// MARK: - Festival deadlines (bundled seed: festivals.json)

struct Festival: Decodable, Identifiable, Hashable {
    var name: String
    var date: String          // yyyy-MM-dd
    var location: String?
    var info: String?
    var tier: String?         // hot | soon | regular
    var url: String?

    var id: String { name + date }

    var day: String {
        guard date.count >= 10 else { return "--" }
        return String(date.dropFirst(8).prefix(2))
    }

    var month: String {
        let months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        guard date.count >= 7, let m = Int(date.dropFirst(5).prefix(2)), m >= 1, m <= 12 else { return "" }
        return months[m - 1]
    }

    /// Days remaining until the deadline (end of that day, UTC).
    var daysLeft: Int? {
        guard let d = Fmt.parseDate(date) else { return nil }
        let target = d.addingTimeInterval(23 * 3600 + 59 * 60)
        return Int(ceil(target.timeIntervalSinceNow / 86400))
    }
}
