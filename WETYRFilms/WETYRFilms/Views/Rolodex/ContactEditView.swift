import SwiftUI

/// Add or edit a Rolodex person or company. Builds the JSON payload that
/// film-rolodex.js expects for addPerson/addCompany/updatePerson/updateCompany.
struct ContactEditView: View {
    enum Kind { case person, company }

    @EnvironmentObject private var rolodex: RolodexService
    @Environment(\.dismiss) private var dismiss

    let kind: Kind
    var existingPerson: Person?
    var existingCompany: Company?
    var companies: [Company] = []
    let onSaved: () async -> Void

    // Shared
    @State private var name = ""
    @State private var notes = ""
    @State private var tags = ""
    @State private var productions = ""
    // Person
    @State private var title = ""
    @State private var dept = ""
    @State private var companyId = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var linkedin = ""
    @State private var imdb = ""
    // Company
    @State private var type = ""
    @State private var parent = ""
    @State private var hq = ""
    @State private var website = ""
    @State private var secCik = ""

    @State private var busy = false
    @State private var error: String?

    init(kind: Kind, existingPerson: Person? = nil, existingCompany: Company? = nil,
         companies: [Company] = [], onSaved: @escaping () async -> Void) {
        self.kind = kind
        self.existingPerson = existingPerson
        self.existingCompany = existingCompany
        self.companies = companies
        self.onSaved = onSaved
    }

    var body: some View {
        NavigationStack {
            Form {
                if kind == .person { personFields } else { companyFields }
                sharedFields
                if let error {
                    Section { Text(error).foregroundStyle(Theme.red).font(.footnote) }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle(navTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() }.tint(Theme.muted) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(busy ? "Saving..." : "Save") { Task { await save() } }
                        .tint(Theme.gold).disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear(perform: hydrate)
        }
        .preferredColorScheme(.dark)
    }

    private var navTitle: String {
        let isEdit = existingPerson != nil || existingCompany != nil
        return (isEdit ? "Edit " : "Add ") + (kind == .person ? "contact" : "company")
    }

    @ViewBuilder private var personFields: some View {
        Section("Contact") {
            field("Name", $name)
            field("Title", $title)
            field("Department", $dept)
            Picker("Company", selection: $companyId) {
                Text("None").tag("")
                ForEach(companies) { c in Text(c.name).tag(c.id) }
            }
        }
        Section("Reach") {
            field("Email", $email, keyboard: .emailAddress)
            field("Phone", $phone, keyboard: .phonePad)
            field("LinkedIn URL", $linkedin)
            field("IMDb name id (nm...)", $imdb)
        }
    }

    @ViewBuilder private var companyFields: some View {
        Section("Company") {
            field("Name", $name)
            field("Type (studio, prodco, agency...)", $type)
            field("Parent", $parent)
            field("HQ / location", $hq)
        }
        Section("Reach") {
            field("Website", $website, keyboard: .URL)
            field("Phone", $phone, keyboard: .phonePad)
            field("Email", $email, keyboard: .emailAddress)
            field("IMDb company id (co...)", $imdb)
            field("SEC CIK", $secCik, keyboard: .numberPad)
        }
    }

    private var sharedFields: some View {
        Section("More") {
            field("Productions (comma separated)", $productions)
            field("Tags (comma separated)", $tags)
            VStack(alignment: .leading) {
                Text("Notes").font(.caption).foregroundStyle(Theme.dim)
                TextEditor(text: $notes).frame(minHeight: 70).scrollContentBackground(.hidden)
            }
        }
    }

    private func field(_ label: String, _ binding: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        TextField(label, text: binding)
            .keyboardType(keyboard)
            .textInputAutocapitalization(keyboard == .emailAddress || keyboard == .URL ? .never : .sentences)
            .autocorrectionDisabled(keyboard == .emailAddress || keyboard == .URL)
    }

    // MARK: - Hydrate from existing

    private func hydrate() {
        if let p = existingPerson {
            name = p.name; title = p.title ?? ""; dept = p.dept ?? ""; companyId = p.companyId ?? ""
            email = p.emailList.first?.address ?? p.email ?? ""
            phone = p.phone ?? ""; linkedin = p.linkedin ?? ""; imdb = p.imdb ?? ""
            notes = p.notes ?? ""; tags = (p.tags ?? []).joined(separator: ", ")
            productions = (p.productions ?? []).joined(separator: ", ")
        }
        if let c = existingCompany {
            name = c.name; type = c.type ?? ""; parent = c.parent ?? ""; hq = c.hq ?? ""
            website = c.website ?? ""; phone = c.allPhones.first ?? ""
            email = c.emails?.first?.address ?? ""; imdb = c.imdb ?? ""; secCik = c.secCik ?? ""
            notes = c.notes ?? ""; tags = (c.tags ?? []).joined(separator: ", ")
            productions = (c.productions ?? []).joined(separator: ", ")
        }
    }

    // MARK: - Save

    private func list(_ s: String) -> [String] {
        s.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    private func save() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            if kind == .person {
                var payload: [String: Any] = ["name": name.trimmingCharacters(in: .whitespaces)]
                put(&payload, "title", title); put(&payload, "dept", dept)
                if !companyId.isEmpty { payload["company_id"] = companyId }
                put(&payload, "email", email); put(&payload, "phone", phone)
                put(&payload, "linkedin", linkedin); put(&payload, "imdb", imdb)
                put(&payload, "notes", notes)
                if !list(tags).isEmpty { payload["tags"] = list(tags) }
                if !list(productions).isEmpty { payload["productions"] = list(productions) }
                if let p = existingPerson {
                    try await rolodex.updatePerson(id: p.id, patch: payload)
                } else {
                    try await rolodex.addPerson(payload)
                }
            } else {
                var payload: [String: Any] = ["name": name.trimmingCharacters(in: .whitespaces)]
                put(&payload, "type", type); put(&payload, "parent", parent); put(&payload, "hq", hq)
                put(&payload, "website", website); put(&payload, "phone", phone)
                put(&payload, "imdb", imdb); put(&payload, "sec_cik", secCik); put(&payload, "notes", notes)
                let e = email.trimmingCharacters(in: .whitespaces)
                if !e.isEmpty { payload["emails"] = [["address": e, "source": "manual"]] }
                if !list(tags).isEmpty { payload["tags"] = list(tags) }
                if !list(productions).isEmpty { payload["productions"] = list(productions) }
                if let c = existingCompany {
                    try await rolodex.updateCompany(id: c.id, patch: payload)
                } else {
                    try await rolodex.addCompany(payload)
                }
            }
            await onSaved()
            dismiss()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func put(_ dict: inout [String: Any], _ key: String, _ value: String) {
        let v = value.trimmingCharacters(in: .whitespaces)
        if !v.isEmpty { dict[key] = v }
    }
}
