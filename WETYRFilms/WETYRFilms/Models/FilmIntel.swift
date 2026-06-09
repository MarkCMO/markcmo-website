import Foundation

/// Mirrors the JSON returned by netlify/functions/film-intel.js (a TMDB proxy).
struct FilmIntelResponse: Decodable {
    var ok: Bool?
    var cached: Bool?
    var fallback: Bool?
    var trending: [TrendingTitle]?
    var nowPlaying: [TrendingTitle]?
    var featured: TitleDetail?
    var featuredList: [TitleDetail]?
    var updatedAt: String?
}

/// A lightweight title row (trending / now-playing strips and box office table).
struct TrendingTitle: Decodable, Identifiable, Hashable {
    let id: Int
    var title: String
    var date: String?
    var voteAverage: Double?
    var voteCount: Int?
    var popularity: Double?
    var poster: String?
    var overview: String?
}

/// Full title detail used by the Title Intelligence card.
struct TitleDetail: Decodable, Identifiable, Hashable {
    let id: Int
    var title: String
    var tagline: String?
    var overview: String?
    var runtime: Int?
    var releaseDate: String?
    var genres: [String]?
    var budget: Int?
    var revenue: Int?
    var voteAverage: Double?
    var voteCount: Int?
    var imdbId: String?
    var poster: String?
    var backdrop: String?
    var productionCompanies: [String]?
    var productionCountries: [String]?
    var cast: [CastMember]?
    var crew: [CrewMember]?
    var watchProviders: WatchProviders?
    var videos: [Video]?

    static func == (lhs: TitleDetail, rhs: TitleDetail) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct CastMember: Decodable, Identifiable, Hashable {
    let id: Int
    var name: String
    var character: String?
}

struct CrewMember: Decodable, Identifiable, Hashable {
    let id: Int
    var name: String
    var job: String?
}

struct WatchProviders: Decodable, Hashable {
    var link: String?
    var flatrate: [WatchProvider]?
    var rent: [WatchProvider]?
    var buy: [WatchProvider]?
}

struct WatchProvider: Decodable, Hashable, Identifiable {
    var providerId: Int?
    var providerName: String?
    var logoPath: String?

    var id: Int { providerId ?? providerName.hashValue }

    enum CodingKeys: String, CodingKey {
        case providerId = "provider_id"
        case providerName = "provider_name"
        case logoPath = "logo_path"
    }

    /// Full TMDB logo URL (w92) if a path exists.
    var logoURL: URL? {
        guard let logoPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w92\(logoPath)")
    }
}

struct Video: Decodable, Hashable, Identifiable {
    var key: String
    var name: String?
    var site: String?
    var type: String?
    var id: String { key }

    /// Best-effort YouTube watch URL.
    var youtubeURL: URL? {
        guard (site ?? "").lowercased() == "youtube" else { return nil }
        return URL(string: "https://www.youtube.com/watch?v=\(key)")
    }
}
