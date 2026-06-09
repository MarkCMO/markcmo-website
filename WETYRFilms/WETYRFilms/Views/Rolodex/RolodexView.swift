import SwiftUI

struct RolodexView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var rolodex = RolodexService()

    @State private var query = ""
    @State private var segment = 0          // 0 = contacts, 1 = companies
    @State private var typeFilter = ""
    @State private var tagFilter = ""
    @State private var deptFilter = ""
    @State private var showFilters = false
    @State private var addingCompany = false
    @State private var addingPerson = false
    @State private var toolMessage: String?

    var body: some View {
        Group {
            if auth.isAuthed {
                authed
            } else if auth.isChecking {
                ProgressView().tint(Theme.gold).frame(maxWidth: .infinity, maxHeight: .infinity).background(Theme.bg)
            } else {
                RolodexLoginView()
            }
        }
        .navigationTitle("Rolodex")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg, for: .navigationBar)
    }

    private var authed: some View {
        VStack(spacing: 0) {
            controls
            Divider().overlay(Theme.border)
            results
        }
        .background(Theme.bg)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Menu {
                    Button { addingPerson = true } label: { Label("Add contact", systemImage: "person.badge.plus") }
                    Button { addingCompany = true } label: { Label("Add company", systemImage: "building.2") }
                } label: { Image(systemName: "plus") }
                .tint(Theme.gold)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { runTool { await rolodex.syncNow() } } label: { Label("Sync now", systemImage: "arrow.triangle.2.circlepath") }
                    Button { runTool { await rolodex.deepCrawl() } } label: { Label("Deep crawl", systemImage: "magnifyingglass.circle") }
                    Button { runTool { await rolodex.freshenStale() } } label: { Label("Freshen stale emails", systemImage: "envelope.badge") }
                    Divider()
                    Button(role: .destructive) { Task { await auth.logout() } } label: { Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right") }
                } label: { Image(systemName: "ellipsis.circle") }
                .tint(Theme.gold)
            }
        }
        .task { if rolodex.companies.isEmpty && rolodex.people.isEmpty { await reload() } }
        .refreshable { await reload() }
        .sheet(isPresented: $addingCompany) { ContactEditView(kind: .company, existingCompany: nil) { await reload() }.environmentObject(rolodex) }
        .sheet(isPresented: $addingPerson) { ContactEditView(kind: .person, existingPerson: nil, companies: rolodex.companies) { await reload() }.environmentObject(rolodex) }
        .overlay(alignment: .bottom) { working }
        .alert("Done", isPresented: Binding(get: { toolMessage != nil }, set: { if !$0 { toolMessage = nil } })) {
            Button("OK") { toolMessage = nil }
        } message: { Text(toolMessage ?? "") }
    }

    // MARK: - Controls

    private var controls: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Theme.dim)
                    TextField("Search name, company, email, IMDb...", text: $query)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                        .submitLabel(.search).onSubmit { Task { await reload() } }
                    if !query.isEmpty {
                        Button { query = ""; Task { await reload() } } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.dim) }
                    }
                }
                .padding(10).background(Theme.panel2).clipShape(RoundedRectangle(cornerRadius: 8))

                Button { showFilters.toggle() } label: {
                    Image(systemName: hasFilters ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                        .foregroundStyle(hasFilters ? Theme.gold : Theme.muted)
                }
            }

            Picker("", selection: $segment) {
                Text("Contacts \(countLabel(rolodex.totals.filteredPeople, rolodex.totals.people))").tag(0)
                Text("Companies \(countLabel(rolodex.totals.filteredCompanies, rolodex.totals.companies))").tag(1)
            }
            .pickerStyle(.segmented)

            if showFilters { filterRow }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    @ViewBuilder private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if segment == 1 {
                    facetMenu(title: "Type", value: $typeFilter, options: rolodex.facets.types ?? [])
                    facetMenu(title: "Tag", value: $tagFilter, options: rolodex.facets.tags ?? [])
                } else {
                    facetMenu(title: "Dept", value: $deptFilter, options: rolodex.facets.depts ?? [])
                }
                if hasFilters {
                    Button {
                        typeFilter = ""; tagFilter = ""; deptFilter = ""
                        Task { await reload() }
                    } label: { Label("Clear", systemImage: "xmark").font(.caption) }
                    .tint(Theme.red)
                }
            }
        }
    }

    private func facetMenu(title: String, value: Binding<String>, options: [String]) -> some View {
        Menu {
            Button("All \(title.lowercased())s") { value.wrappedValue = ""; Task { await reload() } }
            ForEach(options, id: \.self) { opt in
                Button(opt) { value.wrappedValue = opt; Task { await reload() } }
            }
        } label: {
            HStack(spacing: 4) {
                Text(value.wrappedValue.isEmpty ? title : value.wrappedValue).font(.caption.weight(.semibold))
                Image(systemName: "chevron.down").font(.caption2)
            }
            .padding(.horizontal, 12).padding(.vertical, 7)
            .foregroundStyle(value.wrappedValue.isEmpty ? Theme.muted : Theme.gold)
            .background(Theme.panel2).clipShape(Capsule())
        }
    }

    // MARK: - Results

    private var results: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if rolodex.isLoading && rolodex.people.isEmpty && rolodex.companies.isEmpty {
                    CenterMessage(systemImage: "person.2", text: "Loading the Rolodex...")
                } else if let error = rolodex.error {
                    ErrorBanner(message: error) { Task { await reload() } }
                } else if segment == 0 {
                    if rolodex.people.isEmpty {
                        CenterMessage(systemImage: "person.crop.circle.badge.questionmark", text: "No contacts match.")
                    }
                    ForEach(rolodex.people) { p in
                        NavigationLink { ContactDetailView(person: p, companies: rolodex.companies) { await reload() }.environmentObject(rolodex) } label: {
                            PersonCard(person: p)
                        }.buttonStyle(.plain)
                    }
                } else {
                    if rolodex.companies.isEmpty {
                        CenterMessage(systemImage: "building.2.crop.circle", text: "No companies match.")
                    }
                    ForEach(rolodex.companies) { c in
                        NavigationLink { ContactDetailView(company: c) { await reload() }.environmentObject(rolodex) } label: {
                            CompanyCard(company: c)
                        }.buttonStyle(.plain)
                    }
                }

                if rolodex.hasMore {
                    Button { Task { await rolodex.loadMore() } } label: {
                        HStack { if rolodex.isPaging { ProgressView().tint(Theme.gold) }; Text("Load more") }
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .foregroundStyle(Theme.gold)
                    .background(Theme.panel).clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(16)
        }
    }

    @ViewBuilder private var working: some View {
        if let w = rolodex.working {
            HStack(spacing: 10) {
                ProgressView().tint(Theme.gold)
                Text(w).font(.footnote).foregroundStyle(Theme.text)
            }
            .padding(12).background(Theme.panel).clipShape(Capsule())
            .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
            .padding(.bottom, 16)
        }
    }

    // MARK: - Helpers

    private var hasFilters: Bool { !typeFilter.isEmpty || !tagFilter.isEmpty || !deptFilter.isEmpty }

    private func countLabel(_ filtered: Int?, _ total: Int?) -> String {
        guard let total else { return "" }
        if let filtered, filtered != total { return "(\(filtered))" }
        return "(\(total))"
    }

    private func reload() async {
        await rolodex.load(query: query.trimmingCharacters(in: .whitespaces),
                           type: typeFilter, tag: tagFilter, dept: deptFilter)
    }

    private func runTool(_ op: @escaping () async -> String) {
        Task { toolMessage = await op() }
    }
}
