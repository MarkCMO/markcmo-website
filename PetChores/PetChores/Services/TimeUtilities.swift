import Foundation

/// Helpers for the "HH:mm" time strings used in the seed and parent settings, and for
/// quiet hours math. All date math goes through Calendar so leap days, month
/// boundaries, and time zone changes are handled correctly (Section 15).
enum TimeUtilities {

    /// Parse "HH:mm" into (hour, minute). Falls back to (8, 0) on bad input.
    static func components(from hhmm: String) -> (hour: Int, minute: Int) {
        let parts = hhmm.split(separator: ":")
        guard parts.count == 2,
              let h = Int(parts[0]), let m = Int(parts[1]),
              (0...23).contains(h), (0...59).contains(m) else {
            return (8, 0)
        }
        return (h, m)
    }

    /// Combine a calendar day with an "HH:mm" time, in the device local time zone.
    static func date(on day: Date, atTime hhmm: String, calendar: Calendar = .current) -> Date {
        let c = components(from: hhmm)
        return calendar.date(bySettingHour: c.hour, minute: c.minute, second: 0, of: day) ?? day
    }

    /// Minutes since midnight for an "HH:mm" string.
    static func minutesSinceMidnight(_ hhmm: String) -> Int {
        let c = components(from: hhmm)
        return c.hour * 60 + c.minute
    }

    /// Minutes since midnight for a Date.
    static func minutesSinceMidnight(_ date: Date, calendar: Calendar = .current) -> Int {
        let comps = calendar.dateComponents([.hour, .minute], from: date)
        return (comps.hour ?? 0) * 60 + (comps.minute ?? 0)
    }

    /// Is the given time-of-day inside quiet hours? Quiet hours can wrap past midnight
    /// (for example 20:30 to 07:00).
    static func isInQuietHours(_ date: Date, start: String, end: String, calendar: Calendar = .current) -> Bool {
        let now = minutesSinceMidnight(date, calendar: calendar)
        let s = minutesSinceMidnight(start)
        let e = minutesSinceMidnight(end)
        if s == e { return false }
        if s < e {
            // Same-day window, for example 01:00 to 06:00.
            return now >= s && now < e
        } else {
            // Wrapping window, for example 20:30 to 07:00.
            return now >= s || now < e
        }
    }

    /// If `date` lands inside quiet hours, shift it forward to the quiet-hours end time
    /// (Section 7). Otherwise return it unchanged.
    static func shiftedOutOfQuietHours(_ date: Date, start: String, end: String, calendar: Calendar = .current) -> Date {
        guard isInQuietHours(date, start: start, end: end, calendar: calendar) else { return date }
        let endComps = components(from: end)
        let nowMinutes = minutesSinceMidnight(date, calendar: calendar)
        let endMinutes = minutesSinceMidnight(end)
        let startMinutes = minutesSinceMidnight(start)

        // Quiet hours wrapping past midnight: if we are after the start (late evening),
        // the end time is on the next day.
        let crossesMidnight = startMinutes > endMinutes
        let dayBase: Date
        if crossesMidnight && nowMinutes >= startMinutes {
            dayBase = calendar.date(byAdding: .day, value: 1, to: date) ?? date
        } else {
            dayBase = date
        }
        return calendar.date(bySettingHour: endComps.hour, minute: endComps.minute, second: 0, of: dayBase) ?? date
    }

    /// Spread `count` daily slots across the waking day. The first slot is the task's
    /// suggested time; the rest are spaced evenly between wake (quiet-hours end) and the
    /// start of quiet hours (Section 6).
    static func dailySlotTimes(
        count: Int,
        firstSlot hhmm: String,
        wake: String,
        quietStart: String
    ) -> [String] {
        guard count > 1 else { return [hhmm] }

        let firstMinutes = minutesSinceMidnight(hhmm)
        let wakeMinutes = minutesSinceMidnight(wake)
        var endMinutes = minutesSinceMidnight(quietStart)
        // If quiet hours start before wake (unusual), treat the window as the full day.
        if endMinutes <= wakeMinutes { endMinutes = 23 * 60 + 59 }

        let lowerBound = max(wakeMinutes, firstMinutes)
        guard endMinutes > lowerBound else {
            return Array(repeating: hhmm, count: count)
        }

        let step = (endMinutes - lowerBound) / max(count - 1, 1)
        var result: [String] = [hhmm]
        for i in 1..<count {
            let minutes = min(lowerBound + step * i, endMinutes)
            let h = minutes / 60
            let m = minutes % 60
            result.append(String(format: "%02d:%02d", h, m))
        }
        return result
    }
}
