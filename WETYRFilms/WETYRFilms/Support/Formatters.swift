import Foundation

enum Fmt {
    /// Parse the loose date strings the feeds emit (RFC822 from RSS, ISO8601 from
    /// our functions) and return a relative "3h ago" style label.
    static func timeAgo(_ raw: String?) -> String {
        guard let date = parseDate(raw) else { return "" }
        let secs = Date().timeIntervalSince(date)
        if secs < 60 { return "just now" }
        let mins = Int(secs / 60)
        if mins < 60 { return "\(mins)m ago" }
        let hours = mins / 60
        if hours < 24 { return "\(hours)h ago" }
        let days = hours / 24
        if days < 30 { return "\(days)d ago" }
        let months = days / 30
        if months < 12 { return "\(months)mo ago" }
        return "\(months / 12)y ago"
    }

    static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        // ISO8601 with fractional seconds, then plain ISO8601.
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return d }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return d }
        // RFC822 (RSS pubDate): "Wed, 04 Jun 2025 18:30:00 GMT"
        let rfc = DateFormatter()
        rfc.locale = Locale(identifier: "en_US_POSIX")
        for f in ["EEE, dd MMM yyyy HH:mm:ss Z", "EEE, dd MMM yyyy HH:mm:ss zzz", "yyyy-MM-dd"] {
            rfc.dateFormat = f
            if let d = rfc.date(from: raw) { return d }
        }
        return nil
    }

    /// USD with no decimals, abbreviating millions/thousands. 0 / nil -> "-".
    static func money(_ value: Int?) -> String {
        guard let value, value > 0 else { return "-" }
        if value >= 1_000_000 {
            let m = Double(value) / 1_000_000
            return String(format: "$%.1fM", m)
        }
        if value >= 1_000 {
            return "$\(value / 1000)K"
        }
        return "$\(value)"
    }

    static func runtime(_ minutes: Int?) -> String {
        guard let minutes, minutes > 0 else { return "" }
        let h = minutes / 60, m = minutes % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    static func year(_ releaseDate: String?) -> String {
        guard let releaseDate, releaseDate.count >= 4 else { return "" }
        return String(releaseDate.prefix(4))
    }
}
