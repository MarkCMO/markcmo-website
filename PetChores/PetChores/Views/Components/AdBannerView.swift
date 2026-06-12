import SwiftUI
import GoogleMobileAds

/// A SwiftUI wrapper around a Google Mobile Ads banner (320x50), child-directed and
/// non-personalized. Shown only to free users (see MainTabView); the paid unlock hides it.
struct AdBannerView: UIViewRepresentable {
    var adUnitID: String = AdService.bannerUnitID

    func makeUIView(context: Context) -> BannerView {
        let banner = BannerView(adSize: AdSizeBanner)
        banner.adUnitID = adUnitID
        banner.rootViewController = Self.rootViewController()
        banner.load(AdService.request())
        return banner
    }

    func updateUIView(_ uiView: BannerView, context: Context) {}

    private static func rootViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        return scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
    }
}
