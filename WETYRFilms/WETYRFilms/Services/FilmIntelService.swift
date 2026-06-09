import Foundation

@MainActor
final class FilmIntelService: ObservableObject {
    @Published var data: FilmIntelResponse?
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared

    var trending: [TrendingTitle] { data?.trending ?? [] }
    var nowPlaying: [TrendingTitle] { data?.nowPlaying ?? [] }
    var featuredList: [TitleDetail] { data?.featuredList ?? (data?.featured.map { [$0] } ?? []) }
    var updatedAt: Date? { Fmt.parseDate(data?.updatedAt) }

    func load(force: Bool = false) async {
        if isLoading { return }
        if data != nil && !force { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let resp: FilmIntelResponse = try await api.get("/.netlify/functions/film-intel")
            if resp.ok == false {
                error = "Live film intel is not configured (TMDB key missing on the server)."
            }
            data = resp
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
