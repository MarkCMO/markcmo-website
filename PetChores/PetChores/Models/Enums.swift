import Foundation
import SwiftUI

// Central place for the small string enums used across the app. We store the raw
// String on SwiftData models (SwiftData persists String cleanly) and expose a typed
// computed accessor on each model, so the rest of the code works with real enums.

/// How often a care task recurs. Matches CareTaskTemplate.frequency in the seed.
enum TaskFrequency: String, Codable, CaseIterable {
    case daily
    case weekly
    case monthly
    case yearly
}

/// How often a supply cost is incurred. Matches Supply.frequency in the seed.
enum SupplyFrequency: String, Codable, CaseIterable {
    case once
    case monthly
    case yearly
}

/// Lifecycle of a single scheduled task instance.
enum TaskStatus: String, Codable, CaseIterable {
    case pending
    case done       // child tapped Done, may still need parent verification
    case missed     // grace window passed with no completion
    case verified   // parent confirmed it happened
    case rejected   // parent sent it back; treated like pending again
}

/// A budget line is either a one time startup cost or a recurring cost.
enum BudgetEntryType: String, Codable, CaseIterable {
    case startup
    case recurring
}

/// How harshly the "serious lessons" consequence engine treats neglect. A parent picks
/// this in Settings so consequences can be introduced gradually, from training wheels
/// (off) up to real stakes (harsh). Controls how fast a pet's needs climb between chores,
/// and how many days of good care are needed to earn a strike back.
enum ConsequenceIntensity: Int, Codable, CaseIterable, Identifiable {
    case off = 0       // no strikes, no loss: a gentle introduction
    case gentle = 1
    case normal = 2
    case harsh = 3

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .off:    return "Off"
        case .gentle: return "Gentle"
        case .normal: return "Normal"
        case .harsh:  return "Harsh"
        }
    }

    var subtitle: String {
        switch self {
        case .off:    return "No strikes or lost pets. Pure practice."
        case .gentle: return "Slow to slip, easy to recover. A soft start."
        case .normal: return "Real stakes at a fair pace."
        case .harsh:  return "Fast needs, hard to recover. The full lesson."
        }
    }

    /// Fraction of a need (hunger / yard waste / tank fouling) that builds per hour while
    /// a chore is outstanding. Higher = the pet slips toward critical faster.
    var needRatePerHour: Double {
        switch self {
        case .off:    return 0
        case .gentle: return 1.0 / 72.0   // ~3 days to critical
        case .normal: return 1.0 / 36.0   // ~1.5 days
        case .harsh:  return 1.0 / 18.0   // ~18 hours
        }
    }

    /// Consecutive cared-for days needed to earn back one strike. 0 = never (off).
    var streakDaysToRegainStrike: Int {
        switch self {
        case .off:    return 0
        case .gentle: return 2
        case .normal: return 3
        case .harsh:  return 5
        }
    }
}

/// Pet wellbeing mapped to a mood band for art and copy (Section 9).
enum Mood: String, CaseIterable {
    case happy
    case content
    case needsAttention
    case sad
    case pleaseHelp

    /// Wellbeing (0 to 100) to mood band.
    static func from(wellbeing: Int) -> Mood {
        switch wellbeing {
        case 80...100: return .happy
        case 60..<80:  return .content
        case 40..<60:  return .needsAttention
        case 20..<40:  return .sad
        default:       return .pleaseHelp
        }
    }

    /// Friendly label shown to the child.
    var label: String {
        switch self {
        case .happy:          return "Happy"
        case .content:        return "Content"
        case .needsAttention: return "Needs attention"
        case .sad:            return "Sad"
        case .pleaseHelp:     return "Please help me"
        }
    }

    /// SF Symbol used as a stand-in for per pet mood art (Section 14 calls for real art).
    var symbolName: String {
        switch self {
        case .happy:          return "face.smiling.inverse"
        case .content:        return "face.smiling"
        case .needsAttention: return "face.dashed"
        case .sad:            return "cloud.rain"
        case .pleaseHelp:     return "heart.circle"
        }
    }

    var tint: Color {
        switch self {
        case .happy:          return .green
        case .content:        return .mint
        case .needsAttention: return .yellow
        case .sad:            return .orange
        case .pleaseHelp:     return .red
        }
    }
}

/// Grouping used on the Home screen.
enum TimeOfDay: String, CaseIterable, Identifiable {
    case morning = "Morning"
    case afternoon = "Afternoon"
    case evening = "Evening"

    var id: String { rawValue }

    static func from(date: Date, calendar: Calendar = .current) -> TimeOfDay {
        let hour = calendar.component(.hour, from: date)
        switch hour {
        case 0..<12:  return .morning
        case 12..<17: return .afternoon
        default:      return .evening
        }
    }
}
