import SwiftUI
import SwiftData

/// Internal art-review screen: every species rendered in its habitat at once, so the
/// hand-drawn animals can be compared and refined. Shown only under the -uitestGallery
/// launch argument (never in normal use).
struct ArtGalleryView: View {
    @Query(sort: [SortDescriptor(\PetSpecies.difficulty), SortDescriptor(\PetSpecies.name)])
    private var species: [PetSpecies]

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 3)

    var body: some View {
        // A plain VStack (not lazy) so every cell renders for the screenshot even off the
        // initial viewport.
        ScrollView {
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(species, id: \.id) { sp in
                    VStack(spacing: 2) {
                        PetScene(species: sp, mood: .happy)
                            .frame(height: 92)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        Text(sp.name)
                            .font(.system(size: 9, weight: .semibold))
                            .lineLimit(1)
                    }
                }
            }
            .padding(6)
        }
    }
}
