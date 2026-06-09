import SwiftUI

/// Top-level container. The app is tab-based; auth state lives in AuthService and
/// only gates the Rolodex tab, so the public intel modules work with no login.
struct RootView: View {
    @EnvironmentObject private var auth: AuthService

    var body: some View {
        MainTabView()
            .task {
                // Restore any persisted session cookie and verify it once on launch.
                await auth.verify()
            }
    }
}
