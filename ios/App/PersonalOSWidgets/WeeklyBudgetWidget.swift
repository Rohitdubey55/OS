import WidgetKit
import SwiftUI

struct WeeklyBudgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeeklyBudgetEntry {
        WeeklyBudgetEntry(date: Date(), data: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (WeeklyBudgetEntry) -> Void) {
        let data = WidgetDataStore.load()?.budget ?? WidgetDataStore.sample.budget
        completion(WeeklyBudgetEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeeklyBudgetEntry>) -> Void) {
        let data = WidgetDataStore.load()?.budget
        let entry = WeeklyBudgetEntry(date: Date(), data: data)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct WeeklyBudgetEntry: TimelineEntry {
    let date: Date
    let data: BudgetData?
}

struct WeeklyBudgetWidgetView: View {
    var entry: WeeklyBudgetEntry

    var body: some View {
        let budget = entry.data
        let spent = budget?.weeklySpent ?? 0
        let total = budget?.weeklyBudget ?? 0
        let currency = budget?.currency ?? "₹"
        let progress = total > 0 ? min(1.0, Double(spent) / Double(total)) : 0
        let statusColor = Color.budgetColor(spent: spent, budget: total)

        VStack(spacing: 6) {
            ZStack {
                CircularProgressView(
                    progress: progress, lineWidth: 8,
                    trackColor: Color.gray.opacity(0.2),
                    progressColor: statusColor
                ).frame(width: 70, height: 70)

                VStack(spacing: 0) {
                    Text("\(currency)\(formatAmount(spent))")
                        .font(.system(.caption, design: .rounded, weight: .bold))
                        .foregroundColor(statusColor)
                    Text("of \(currency)\(formatAmount(total))")
                        .font(.system(size: 8, design: .rounded))
                        .foregroundColor(.secondary)
                }
            }

            let remaining = total - spent
            Text(remaining >= 0 ? "\(currency)\(formatAmount(remaining)) left" : "Over by \(currency)\(formatAmount(-remaining))")
                .font(.system(.caption2, design: .rounded, weight: .medium))
                .foregroundColor(statusColor)
        }
        .padding()
        .widgetURL(URL(string: "personalos://finance"))
    }

    func formatAmount(_ n: Int) -> String {
        if n >= 100000 { return "\(n / 100000).\(n % 100000 / 10000)L" }
        if n >= 1000 { return "\(n / 1000).\(n % 1000 / 100)k" }
        return "\(n)"
    }
}

struct WeeklyBudgetWidget: Widget {
    let kind = "WeeklyBudgetWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeeklyBudgetProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                WeeklyBudgetWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                WeeklyBudgetWidgetView(entry: entry)
                    .padding()
                    .background(Color(.systemBackground))
            }
        }
        .configurationDisplayName("Weekly Budget")
        .description("Weekly spending vs budget")
        .supportedFamilies([.systemSmall])
    }
}
