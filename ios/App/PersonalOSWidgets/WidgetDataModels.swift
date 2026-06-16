import Foundation

struct WidgetData: Codable {
    let habits: HabitsData?
    let tasks: [TaskItem]?
    let lifeProgress: LifeProgressData?
    let budget: BudgetData?
    let reading: ReadingData?
    let updatedAt: String?
}

struct HabitsData: Codable {
    let total: Int
    let completed: Int
    let items: [HabitItem]
}

struct HabitItem: Codable, Identifiable {
    var id: String { name }
    let name: String
    let icon: String
    let done: Bool
}

struct TaskItem: Codable, Identifiable {
    var id: String { title }
    let title: String
    let priority: String
    let done: Bool
}

struct LifeProgressData: Codable {
    let weeksLived: Int
    let totalWeeks: Int
    let ageYears: Int
    let percentage: Int
}

struct BudgetData: Codable {
    let weeklyBudget: Int
    let weeklySpent: Int
    let currency: String
}

struct ReadingData: Codable {
    let currentBook: String
    let author: String
    let currentPage: Int
    let totalPages: Int
    let percentage: Int
}

struct WidgetDataStore {
    static let appGroupID = "group.com.personal.os"

    static func load() -> WidgetData? {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            NSLog("[WidgetData] ❌ Cannot open App Group: %@", appGroupID)
            return nil
        }
        guard let jsonString = defaults.string(forKey: "widgetData") else {
            NSLog("[WidgetData] ⚠️ No 'widgetData' key in UserDefaults — app hasn't sent data yet")
            return nil
        }
        guard let data = jsonString.data(using: .utf8) else {
            NSLog("[WidgetData] ❌ Cannot convert JSON string to Data")
            return nil
        }
        do {
            let decoded = try JSONDecoder().decode(WidgetData.self, from: data)
            NSLog("[WidgetData] ✅ Loaded widget data (updatedAt: %@)", decoded.updatedAt ?? "nil")
            return decoded
        } catch {
            NSLog("[WidgetData] ❌ JSON decode error: %@", error.localizedDescription)
            return nil
        }
    }

    static let sample = WidgetData(
        habits: HabitsData(total: 8, completed: 5, items: [
            HabitItem(name: "Meditate", icon: "🧘", done: true),
            HabitItem(name: "Read", icon: "📖", done: true),
            HabitItem(name: "Exercise", icon: "🏋️", done: true),
            HabitItem(name: "Journal", icon: "📝", done: true),
            HabitItem(name: "Cold Shower", icon: "🚿", done: true),
            HabitItem(name: "No Sugar", icon: "🍭", done: false),
            HabitItem(name: "Walk 10k", icon: "🚶", done: false),
            HabitItem(name: "Sleep by 11", icon: "😴", done: false)
        ]),
        tasks: [
            TaskItem(title: "Review project proposal", priority: "P1", done: false),
            TaskItem(title: "Call dentist", priority: "P1", done: false),
            TaskItem(title: "Update portfolio", priority: "P2", done: true),
            TaskItem(title: "Grocery shopping", priority: "P2", done: false),
            TaskItem(title: "Read chapter 5", priority: "P3", done: false)
        ],
        lifeProgress: LifeProgressData(weeksLived: 1456, totalWeeks: 2600, ageYears: 28, percentage: 56),
        budget: BudgetData(weeklyBudget: 5000, weeklySpent: 3200, currency: "₹"),
        reading: ReadingData(currentBook: "Atomic Habits", author: "James Clear", currentPage: 142, totalPages: 310, percentage: 46),
        updatedAt: "2026-03-21T10:00:00Z"
    )
}
