import SwiftUI

/// Sign-in gate for the internal Rolodex. Uses the same admin credentials as the
/// markcmo.com admin console (admin-auth.js).
struct RolodexLoginView: View {
    @EnvironmentObject private var auth: AuthService
    @State private var user = ""
    @State private var pass = ""
    @State private var busy = false
    @FocusState private var focus: Field?
    private enum Field { case user, pass }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 44)).foregroundStyle(Theme.gold)
                    .padding(.top, 50)
                VStack(spacing: 4) {
                    Text("Industry Rolodex").font(.title2.weight(.heavy)).foregroundStyle(Theme.text)
                    Text("Internal contacts. Sign in to continue.")
                        .font(.subheadline).foregroundStyle(Theme.muted)
                }

                Panel {
                    VStack(spacing: 12) {
                        TextField("Username", text: $user)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .textContentType(.username)
                            .focused($focus, equals: .user)
                            .submitLabel(.next)
                            .onSubmit { focus = .pass }
                            .padding(12).background(Theme.panel2).clipShape(RoundedRectangle(cornerRadius: 8))

                        SecureField("Password", text: $pass)
                            .textContentType(.password)
                            .focused($focus, equals: .pass)
                            .submitLabel(.go)
                            .onSubmit { Task { await signIn() } }
                            .padding(12).background(Theme.panel2).clipShape(RoundedRectangle(cornerRadius: 8))

                        if let err = auth.lastError {
                            Text(err).font(.footnote).foregroundStyle(Theme.red).frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button {
                            Task { await signIn() }
                        } label: {
                            HStack {
                                if busy { ProgressView().tint(.black) }
                                Text(busy ? "Signing in..." : "Sign in").fontWeight(.bold)
                            }
                            .frame(maxWidth: .infinity, minHeight: 48)
                        }
                        .background(Theme.gold).foregroundStyle(.black)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .disabled(busy || user.isEmpty || pass.isEmpty)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .onAppear { focus = .user }
    }

    private func signIn() async {
        guard !busy else { return }
        busy = true; defer { busy = false }
        _ = await auth.login(user: user.trimmingCharacters(in: .whitespaces), pass: pass)
    }
}
