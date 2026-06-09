import Foundation

/// Loads the public feed modules: industry news, casting calls, and the bundled
/// festival deadline list.
@MainActor
final class FeedsService: ObservableObject {
    // News
    @Published var news: [NewsItem] = []
    @Published var newsFetchedAt: Date?
    @Published var newsLoading = false
    @Published var newsError: String?

    // Casting
    @Published var castingScripted: [CastingCall] = []
    @Published var castingCommercial: [CastingCall] = []
    @Published var castingFetchedAt: Date?
    @Published var castingSourcesOk: Int?
    @Published var castingSourceCount: Int?
    @Published var castingLoading = false
    @Published var castingError: String?

    // Festivals (bundled, no network)
    @Published var festivals: [Festival] = []

    private let api = APIClient.shared

    func loadNews(force: Bool = false) async {
        if newsLoading || (!news.isEmpty && !force) { return }
        newsLoading = true; newsError = nil
        defer { newsLoading = false }
        do {
            let resp: NewsResponse = try await api.get("/.netlify/functions/news-feed")
            news = resp.items ?? []
            newsFetchedAt = Fmt.parseDate(resp.fetchedAt)
            if news.isEmpty { newsError = "No headlines from the public trades right now." }
        } catch {
            newsError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loadCasting(force: Bool = false) async {
        if castingLoading || (!castingScripted.isEmpty && !force) { return }
        castingLoading = true; castingError = nil
        defer { castingLoading = false }
        do {
            let resp: CastingResponse = try await api.get("/.netlify/functions/casting-calls")
            castingScripted = resp.scripted ?? []
            castingCommercial = resp.commercial ?? []
            castingFetchedAt = Fmt.parseDate(resp.fetchedAt)
            castingSourcesOk = resp.sourcesOk
            castingSourceCount = resp.sourceCount
        } catch {
            castingError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loadFestivals() {
        guard festivals.isEmpty else { return }
        guard let url = Bundle.main.url(forResource: "festivals", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([Festival].self, from: data) else {
            festivals = []
            return
        }
        // Sort by deadline, soonest first.
        festivals = list.sorted { (Fmt.parseDate($0.date) ?? .distantFuture) < (Fmt.parseDate($1.date) ?? .distantFuture) }
    }
}
