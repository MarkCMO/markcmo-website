import SwiftUI
import SwiftData
import UIKit

/// Verify Tasks (Section 11): done-but-unverified tasks, each with Verify or Reject.
struct VerifyTasksView: View {
    @Environment(\.modelContext) private var context

    @Query(filter: #Predicate<ScheduledTask> { $0.statusRaw == "done" },
           sort: [SortDescriptor(\ScheduledTask.completedAt, order: .reverse)])
    private var tasks: [ScheduledTask]

    private let actions = TaskActions()
    @State private var showConfetti = false

    var body: some View {
        Group {
            if tasks.isEmpty {
                ContentUnavailableView("All caught up",
                                       systemImage: "checkmark.seal",
                                       description: Text("No chores are waiting to be checked."))
            } else {
                List {
                    ForEach(tasks) { task in
                        VerifyRow(task: task,
                                  onVerify: { actions.verify(task, context: context); celebrate() },
                                  onReject: { actions.reject(task, context: context) })
                    }
                }
            }
        }
        .navigationTitle("Verify Tasks")
        .overlay {
            if showConfetti { ConfettiView() }
        }
    }

    private func celebrate() {
        withAnimation { showConfetti = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            withAnimation { showConfetti = false }
        }
    }
}

private struct VerifyRow: View {
    @Bindable var task: ScheduledTask
    let onVerify: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(task.label).font(.headline)
                    if let done = task.completedAt {
                        Text("Marked done \(DayFormat.time.string(from: done))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Text(task.onTime ? "On time" : "Late")
                        .font(.caption2)
                        .foregroundStyle(task.onTime ? .green : .orange)
                }
                Spacer()
            }

            if let file = task.photoFileName, let image = PhotoStore.load(file) {
                Image(uiImage: image)
                    .resizable().scaledToFill()
                    .frame(height: 140).frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            HStack(spacing: 12) {
                Button {
                    onReject()
                } label: {
                    Label("Send back", systemImage: "arrow.uturn.backward")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)
                .tint(.orange)

                Button {
                    onVerify()
                } label: {
                    Label("Verify", systemImage: "checkmark")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(.vertical, 6)
    }
}
