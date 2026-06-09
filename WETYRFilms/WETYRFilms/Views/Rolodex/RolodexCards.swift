import SwiftUI

/// Compact summary card for a contact in the Rolodex list.
struct PersonCard: View {
    let person: Person

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(person.name).font(.headline).foregroundStyle(Theme.text)
            if !person.subtitle.isEmpty {
                Text(person.subtitle).font(.caption).foregroundStyle(Theme.muted)
            }
            if let primary = person.emailList.first {
                HStack(spacing: 6) {
                    Image(systemName: "envelope").font(.caption2).foregroundStyle(Theme.dim)
                    Text(primary.address).font(.caption).foregroundStyle(Theme.blue).lineLimit(1)
                    if let band = primary.band { FreshnessBadge(band: band) }
                }
            } else {
                Label("no email on file", systemImage: "envelope.badge").font(.caption2).foregroundStyle(Theme.dim)
            }
            if let tags = person.tags, !tags.isEmpty {
                WrapTags(tags: Array(tags.prefix(3)))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.panel)
        .overlay(RoundedRectangle(cornerRadius: Theme.cardCorner).stroke(Theme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Theme.cardCorner))
    }
}

/// Compact summary card for a company in the Rolodex list.
struct CompanyCard: View {
    let company: Company

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(company.name).font(.headline).foregroundStyle(Theme.text)
            Text([company.type, company.parent].compactMap { $0 }.joined(separator: " . "))
                .font(.caption).foregroundStyle(Theme.muted)
            if let hq = company.hq, !hq.isEmpty {
                Label(hq, systemImage: "mappin.and.ellipse").font(.caption).foregroundStyle(Theme.muted)
            }
            HStack(spacing: 12) {
                if let emails = company.emails, !emails.isEmpty {
                    Label("\(emails.count) email\(emails.count == 1 ? "" : "s")", systemImage: "envelope").font(.caption2).foregroundStyle(Theme.green)
                }
                if !company.allPhones.isEmpty {
                    Label("\(company.allPhones.count) phone\(company.allPhones.count == 1 ? "" : "s")", systemImage: "phone").font(.caption2).foregroundStyle(Theme.dim)
                }
            }
            if let tags = company.tags, !tags.isEmpty {
                WrapTags(tags: Array(tags.prefix(3)))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.panel)
        .overlay(RoundedRectangle(cornerRadius: Theme.cardCorner).stroke(Theme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Theme.cardCorner))
    }
}

/// Freshness badge mirroring the web CURRENT/LIKELY/AGING/OLD/STALE bands.
struct FreshnessBadge: View {
    let band: EmailEntry.Band
    var body: some View {
        Text(band.rawValue)
            .font(.system(size: 9, weight: .bold)).tracking(0.5)
            .padding(.horizontal, 5).padding(.vertical, 1)
            .foregroundStyle(color)
            .overlay(RoundedRectangle(cornerRadius: 3).stroke(color, lineWidth: 1))
    }
    private var color: Color {
        switch band {
        case .current: return Color(hex: 0x10B981)
        case .likely: return Color(hex: 0x22C55E)
        case .aging: return Color(hex: 0xFBBF24)
        case .old: return Color(hex: 0xF97316)
        case .stale: return Color(hex: 0xEF4444)
        }
    }
}
