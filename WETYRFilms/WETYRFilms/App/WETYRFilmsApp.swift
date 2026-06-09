import SwiftUI

/// WETYR Films, the native companion to the WETYR Film Intel dashboard.
/// Reads live production intel (TMDB box office, trending titles, industry news,
/// festival deadlines, casting calls) and the internal industry Rolodex from the
/// same Netlify Functions that power markcmo.com/wetyr-films.
@main
struct WETYRFilmsApp: App {

    @StateObject private var auth = AuthService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .preferredColorScheme(.dark)
                .tint(Theme.gold)
        }
    }
}
