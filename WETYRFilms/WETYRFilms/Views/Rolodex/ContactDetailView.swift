import SwiftUI

/// Full detail for a Rolodex person or company, with actionable links
/// (mailto / tel / web / IMDb), enrichment, edit, and delete.
struct ContactDetailView: View {
    @EnvironmentObject private var rolodex: RolodexService
    @Environment(\.dismiss) private var dismiss

    // One of these is set.
    var person: Person?
    var company: Company?
    var companies: [Company] = []
    let onChange: () async -> Void

    @State private var editing = false
    @State private var confirmDelete = false
    @State private var actionMessage: String?
    @State private var busy = false

    init(person: Person, companies: [Company], onChange: @escaping () async -> Void) {
        self.person = person; self.companies = companies; self.onChange = onChange
    }
    init(company: Company, onChange: @escaping () async -> Void) {
        self.company = company; self.onChange = onChange
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                if let person { personBody(person) }
                if let company { companyBody(company) }
                actions
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle(person?.name ?? company?.name ?? "Contact")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { editing = true } label: { Image(systemName: "pencil") }.tint(Theme.gold)
            }
        }
        .sheet(isPresented: $editing) { editSheet }
        .alert("Delete?", isPresented: $confirmDelete) {
            Button("Delete", role: .destructive) { Task { await performDelete() } }
            Button("Cancel", role: .cancel) {}
        } message: { Text("This permanently removes the record from the Rolodex.") }
        .alert("Result", isPresented: Binding(get: { actionMessage != nil }, set: { if !$0 { actionMessage = nil } })) {
            Button("OK") { actionMessage = nil }
        } message: { Text(actionMessage ?? "") }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(person?.name ?? company?.name ?? "").font(.title2.weight(.heavy)).foregroundStyle(Theme.text)
            if let sub = subtitle, !sub.isEmpty {
                Text(sub).font(.subheadline).foregroundStyle(Theme.gold)
            }
            if let tags = (person?.tags ?? company?.tags), !tags.isEmpty {
                WrapTags(tags: tags)
            }
        }
    }

    private var subtitle: String? {
        if let person { return person.subtitle }
        if let company { return [company.type, company.parent].compactMap { $0 }.joined(separator: " . ") }
        return nil
    }

    // MARK: - Person body

    @ViewBuilder private func personBody(_ p: Person) -> some View {
        Panel(title: "Contact info") {
            VStack(alignment: .leading, spacing: 10) {
                if p.emailList.isEmpty {
                    Label("no email on file", systemImage: "envelope.badge").font(.subheadline).foregroundStyle(Theme.dim)
                } else {
                    ForEach(p.emailList) { e in emailRow(e) }
                }
                if let phone = p.phone, !phone.isEmpty {
                    DetailRow(icon: "phone.fill", text: phone, url: telURL(phone))
                }
                if let li = p.linkedin, let url = URL(string: li) {
                    DetailRow(icon: "link", text: "LinkedIn", url: url)
                }
                if let imdb = p.imdb, let url = URL(string: "https://www.imdb.com/name/\(imdb)/") {
                    DetailRow(icon: "film", text: "IMDb profile", url: url)
                }
            }
        }
        extra(productions: p.productions, notes: p.notes)
    }

    private func emailRow(_ e: EmailEntry) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "envelope.fill").frame(width: 20).foregroundStyle(Theme.gold)
            if let url = URL(string: "mailto:\(e.address)") {
                Link(e.address, destination: url).foregroundStyle(e.isArchived ? Theme.dim : Theme.blue)
                    .strikethrough(e.isArchived)
            }
            if e.isPrimary == true { Image(systemName: "star.fill").font(.caption2).foregroundStyle(Theme.gold) }
            if let band = e.band { FreshnessBadge(band: band) }
            Spacer(minLength: 0)
            if let src = e.source { Text(src).font(.caption2).foregroundStyle(Theme.dim) }
        }
        .font(.subheadline)
    }

    // MARK: - Company body

    @ViewBuilder private func companyBody(_ c: Company) -> some View {
        Panel(title: "Company info") {
            VStack(alignment: .leading, spacing: 10) {
                if let hq = c.hq, !hq.isEmpty { DetailRow(icon: "mappin.and.ellipse", text: hq) }
                if let web = c.website, let url = URL(string: web) {
                    DetailRow(icon: "globe", text: web.replacingOccurrences(of: "https://", with: "").replacingOccurrences(of: "http://", with: ""), url: url)
                }
                ForEach(c.allPhones, id: \.self) { phone in
                    DetailRow(icon: "phone.fill", text: phone, url: telURL(phone))
                }
                if let emails = c.emails {
                    ForEach(emails) { e in
                        DetailRow(icon: "envelope.fill", text: e.address, url: URL(string: "mailto:\(e.address)"))
                    }
                }
                if let imdb = c.imdb, let url = URL(string: "https://www.imdb.com/company/\(imdb)/") {
                    DetailRow(icon: "film", text: "IMDb: \(imdb)", url: url)
                }
                if let cik = c.secCik, let url = URL(string: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=\(cik)") {
                    DetailRow(icon: "doc.text", text: "SEC CIK: \(cik)", url: url)
                }
            }
        }
        extra(productions: c.productions, notes: c.notes)
    }

    @ViewBuilder private func extra(productions: [String]?, notes: String?) -> some View {
        if let prods = productions, !prods.isEmpty {
            Panel(title: "Productions") {
                Text(prods.prefix(12).joined(separator: " . ")).font(.subheadline).foregroundStyle(Theme.muted)
            }
        }
        if let notes, !notes.isEmpty {
            Panel(title: "Notes") {
                Text(notes).font(.subheadline).foregroundStyle(Theme.muted)
            }
        }
    }

    // MARK: - Actions

    private var actions: some View {
        VStack(spacing: 10) {
            if let p = person {
                actionButton("Find email", "magnifyingglass") { await rolodex.enrichPerson(id: p.id) }
                actionButton("Find newest email", "envelope.arrow.triangle.branch") { await rolodex.findNewestEmail(id: p.id) }
            }
            if let c = company {
                actionButton("Find emails", "magnifyingglass") { await rolodex.enrichCompany(id: c.id) }
            }
            Button(role: .destructive) { confirmDelete = true } label: {
                Label("Delete", systemImage: "trash").frame(maxWidth: .infinity, minHeight: 44)
            }
            .tint(Theme.red)
        }
        .disabled(busy)
    }

    private func actionButton(_ title: String, _ icon: String, _ op: @escaping () async -> String) -> some View {
        Button {
            Task {
                busy = true
                let msg = await op()
                busy = false
                actionMessage = msg
                await onChange()
            }
        } label: {
            Label(title, systemImage: icon).frame(maxWidth: .infinity, minHeight: 44)
        }
        .foregroundStyle(Theme.gold)
        .background(Theme.panel).clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.gold.opacity(0.5), lineWidth: 1))
    }

    @ViewBuilder private var editSheet: some View {
        if let p = person {
            ContactEditView(kind: .person, existingPerson: p, companies: companies) {
                await onChange()
            }.environmentObject(rolodex)
        } else if let c = company {
            ContactEditView(kind: .company, existingCompany: c) {
                await onChange()
            }.environmentObject(rolodex)
        }
    }

    private func performDelete() async {
        busy = true; defer { busy = false }
        do {
            if let p = person { try await rolodex.deletePerson(id: p.id) }
            else if let c = company { try await rolodex.deleteCompany(id: c.id) }
            await onChange()
            dismiss()
        } catch {
            actionMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func telURL(_ phone: String) -> URL? {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        return URL(string: "tel:\(digits)")
    }
}
