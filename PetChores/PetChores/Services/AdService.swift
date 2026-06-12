import Foundation
import GoogleMobileAds

/// Google Mobile Ads (AdMob) setup. This app is directed at children, so ads are always
/// child-directed (COPPA / under-age-of-consent) and non-personalized, and never use the
/// IDFA / App Tracking Transparency prompt. Ads are shown only to FREE users; the paid
/// unlock (petchores.unlock.full) removes them. The ad unit ids below are Google's PUBLIC
/// TEST ids; swap in the real AdMob ids (and the GADApplicationIdentifier in Info.plist)
/// before the production release.
@MainActor
enum AdService {

    /// Google's official test banner unit id (320x50). Replace for production.
    static let bannerUnitID = "ca-app-pub-3940256099942544/2934735716"
    /// Google's official test interstitial unit id. Replace for production.
    static let interstitialUnitID = "ca-app-pub-3940256099942544/4411468910"

    private static var started = false

    /// Initialize the SDK once, with the strictest child-safe configuration.
    static func start() {
        guard !started else { return }
        started = true

        let config = MobileAds.shared.requestConfiguration
        config.tagForChildDirectedTreatment = true
        config.tagForUnderAgeOfConsent = true

        MobileAds.shared.start()
    }

    /// A non-personalized ad request (npa=1), required for child-directed traffic.
    static func request() -> Request {
        let request = Request()
        let extras = Extras()
        extras.additionalParameters = ["npa": "1"]
        request.register(extras)
        return request
    }
}
