// Loads the bundled species catalog. The JSON ships in assets/ and is read-only.
import raw from "../assets/pet_database.json";
import { PetDatabase, PetSpecies } from "./types";

export const catalog: PetSpecies[] = (raw as PetDatabase).pets;

export function speciesById(id: string): PetSpecies | undefined {
  return catalog.find((p) => p.id === id);
}

// Emoji stand-ins per species (kid-friendly, zero-asset). Swap for art later.
export function speciesEmoji(id: string): string {
  const map: Record<string, string> = {
    dog: "\u{1F436}", cat: "\u{1F431}", rabbit: "\u{1F430}", hamster: "\u{1F439}",
    guinea_pig: "\u{1F439}", fish: "\u{1F420}", betta: "\u{1F41F}", parakeet: "\u{1F99C}",
    turtle: "\u{1F422}", leopard_gecko: "\u{1F98E}", tortoise: "\u{1F422}",
    chicken: "\u{1F414}", tarantula: "\u{1F577}",
  };
  return map[id] ?? "\u{1F43E}";
}

// Habitat gradient per category (kid-friendly backdrops).
export function habitatColors(category: string, id: string): [string, string] {
  if (id === "turtle" || category === "aquatic") return ["#2E8BC6", "#0E4D7A"];
  switch (category) {
    case "mammal": return ["#8ED0FA", "#D9F2E6"];
    case "small_mammal": return ["#FBEFD2", "#EEDAB2"];
    case "bird": return ["#EAF2FF", "#CFE0F2"];
    case "reptile": return ["#E0B884", "#C49A66"];
    case "poultry": return ["#9ED0F5", "#BFE6A8"];
    case "invertebrate": return ["#9A8A86", "#5E4A46"];
    default: return ["#8ED0FA", "#D9F2E6"];
  }
}
