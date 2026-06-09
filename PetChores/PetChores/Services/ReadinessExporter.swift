import Foundation
import UIKit

/// Produces a shareable PDF of the Readiness Report (Section 12). Text export is built
/// by ReadinessService.exportText.
enum ReadinessExporter {

    /// Render the report text to a simple single-page PDF and return a temp file URL.
    static func makePDF(title: String, body: String) -> URL? {
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792) // US Letter
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("ReadinessReport.pdf")

        do {
            try renderer.writePDF(to: url) { ctx in
                ctx.beginPage()
                let margin: CGFloat = 48

                let titleAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.boldSystemFont(ofSize: 24)
                ]
                title.draw(at: CGPoint(x: margin, y: margin), withAttributes: titleAttrs)

                let bodyAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 13)
                ]
                let bodyRect = CGRect(
                    x: margin,
                    y: margin + 44,
                    width: pageRect.width - margin * 2,
                    height: pageRect.height - margin * 2 - 44
                )
                body.draw(in: bodyRect, withAttributes: bodyAttrs)
            }
            return url
        } catch {
            return nil
        }
    }
}
