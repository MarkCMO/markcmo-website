import SwiftUI

struct MainTabView: View {
    @StateObject private var intel = FilmIntelService()
    @StateObject private var feeds = FeedsService()

    var body: some View {
        TabView {
            NavigationStack { TitleIntelView(intel: intel) }
                .tabItem { Label("Titles", systemImage: "film.fill") }

            NavigationStack { BoxOfficeView(intel: intel) }
                .tabItem { Label("Box Office", systemImage: "chart.bar.fill") }

            NavigationStack { BriefingView(feeds: feeds) }
                .tabItem { Label("Briefing", systemImage: "newspaper.fill") }

            NavigationStack { CastingView(feeds: feeds) }
                .tabItem { Label("Casting", systemImage: "megaphone.fill") }

            NavigationStack { RolodexView() }
                .tabItem { Label("Rolodex", systemImage: "person.2.fill") }
        }
        .tint(Theme.gold)
        .background(Theme.bg)
    }
}
