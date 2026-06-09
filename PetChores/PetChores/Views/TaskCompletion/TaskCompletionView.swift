import SwiftUI
import SwiftData
import PhotosUI
import UIKit

/// Task Completion screen (Section 8): the real-world instruction as a checklist, a
/// "what happens if I skip this" expander, optional photo proof, and a big Done button.
struct TaskCompletionView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: StoreService

    @Bindable var task: ScheduledTask
    let petNickname: String

    @State private var showConsequence = false
    @State private var capturedImage: UIImage?
    @State private var showCamera = false
    @State private var photoItem: PhotosPickerItem?
    @State private var showConfetti = false

    private var settings: ParentSettings? { DataStore.parentSettings(context) }

    /// Photo proof applies only when enabled by the parent and the app is unlocked.
    private var photoRequired: Bool {
        guard let settings else { return false }
        return settings.photoProofRequired && FreeTier.photoProofAvailable(isUnlocked: store.isUnlocked)
    }

    private var doneDisabled: Bool {
        // Already done or verified: do not let it fire again (avoids double-awarding).
        if task.status == .done || task.status == .verified { return true }
        if photoRequired && capturedImage == nil && task.photoFileName == nil { return true }
        return false
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header

                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("What to do").font(.headline)
                        ForEach(checklistItems, id: \.self) { item in
                            Label(item, systemImage: "checkmark.circle")
                                .font(.body)
                        }
                    }
                }

                consequenceCard

                if photoRequired {
                    photoCard
                }

                if task.status == .done {
                    waitingCallout
                }

                Spacer(minLength: 8)
            }
            .padding()
        }
        .navigationTitle(task.label)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            doneBar
        }
        .sheet(isPresented: $showCamera) {
            CameraPicker { image in capturedImage = image }
        }
        .onChange(of: photoItem) { _, newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    capturedImage = image
                }
            }
        }
        .overlay {
            if showConfetti { ConfettiView() }
        }
    }

    // MARK: - Pieces

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: statusIcon)
                .font(.title)
                .foregroundStyle(Color.accentColor)
            VStack(alignment: .leading) {
                Text(task.label).font(.title3.bold())
                Text("Due \(DayFormat.time.string(from: task.dueAt))")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            StatusChip(status: task.status)
        }
    }

    private var consequenceCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Button {
                    withAnimation { showConsequence.toggle() }
                } label: {
                    HStack {
                        Label("What happens if I skip this?", systemImage: "questionmark.circle")
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Image(systemName: showConsequence ? "chevron.up" : "chevron.down")
                    }
                }
                .buttonStyle(.plain)
                if showConsequence {
                    Text(task.consequence)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var photoCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Add a photo as proof").font(.headline)
                if let image = capturedImage {
                    Image(uiImage: image)
                        .resizable().scaledToFill()
                        .frame(height: 160).frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                } else if let file = task.photoFileName, let image = PhotoStore.load(file) {
                    Image(uiImage: image)
                        .resizable().scaledToFill()
                        .frame(height: 160).frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                HStack {
                    if CameraPicker.isAvailable {
                        Button { showCamera = true } label: {
                            Label("Take photo", systemImage: "camera.fill")
                        }
                        .buttonStyle(.bordered)
                    }
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("Choose photo", systemImage: "photo")
                    }
                    .buttonStyle(.bordered)
                }
                Text("Photos stay on this device and are never uploaded.")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
    }

    private var waitingCallout: some View {
        Card {
            Label("Waiting for grown-up to check", systemImage: "clock")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.purple)
        }
    }

    @ViewBuilder
    private var doneBar: some View {
        if task.status != .verified {
            VStack {
                Button(doneTitle) { markDone() }
                    .buttonStyle(BigButtonStyle())
                    .disabled(doneDisabled)
            }
            .padding()
            .background(.bar)
        }
    }

    // MARK: - Logic

    private var checklistItems: [String] {
        // Split the real action into checklist-style steps on sentence boundaries.
        task.realAction
            .split(separator: ".")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    private var doneTitle: String {
        task.status == .done ? "Marked done" : "Done"
    }

    private var statusIcon: String {
        switch task.status {
        case .verified: return "checkmark.seal.fill"
        case .done:     return "clock.fill"
        case .missed:   return "exclamationmark.circle.fill"
        default:        return "pawprint.fill"
        }
    }

    private func markDone() {
        var savedFile: String? = task.photoFileName
        if let image = capturedImage {
            savedFile = PhotoStore.save(image)
        }
        TaskActions().markDone(task, photoFileName: savedFile, context: context)
        // Give the child a quick celebration before returning to the list.
        withAnimation { showConfetti = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            dismiss()
        }
    }
}
