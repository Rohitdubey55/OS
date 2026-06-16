import WidgetKit
import SwiftUI

struct HabitChecklistProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitChecklistEntry {
        HabitChecklistEntry(date: Date(), habits: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (HabitChecklistEntry) -> Void) {
        let data = WidgetDataStore.load()?.habits ?? WidgetDataStore.sample.habits
        completion(HabitChecklistEntry(date: Date(), habits: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitChecklistEntry>) -> Void) {
        let data = WidgetDataStore.load()?.habits
        let entry = HabitChecklistEntry(date: Date(), habits: data)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct HabitChecklistEntry: TimelineEntry {
    let date: Date
    let habits: HabitsData?
}

struct HabitChecklistWidgetView: View {
    var entry: HabitChecklistEntry

    var body: some View {
        let items = entry.habits?.items ?? []
        let completed = entry.habits?.completed ?? 0
        let total = entry.habits?.total ?? 0

        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text("Today's Habits")
                    .font(.system(.headline, design: .rounded, weight: .bold))
                Spacer()
                Text("\(completed)/\(total)")
                    .font(.system(.caption, design: .rounded, weight: .semibold))
                    .foregroundColor(completed == total && total > 0 ? .green : .secondary)
            }
            .padding(.bottom, 2)

            if items.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 4) {
                        Text("🧘").font(.title2)
                        Text("No habits scheduled").font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                }
                Spacer()
            } else {
                let displayItems = Array(items.prefix(6))
                let columns = displayItems.count > 3 ?
                    [GridItem(.flexible()), GridItem(.flexible())] :
                    [GridItem(.flexible())]

                LazyVGrid(columns: columns, alignment: .leading, spacing: 4) {
                    ForEach(displayItems) { habit in
                        HStack(spacing: 6) {
                            Text(habit.icon).font(.system(size: 14)).frame(width: 20)
                            Text(habit.name)
                                .font(.system(.caption, design: .rounded))
                                .lineLimit(1)
                                .foregroundColor(habit.done ? .secondary : .primary)
                            Spacer()
                            Image(systemName: habit.done ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 14))
                                .foregroundColor(habit.done ? .green : Color.gray.opacity(0.4))
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding()
        .widgetURL(URL(string: "personalos://habits"))
    }
}

struct HabitChecklistWidget: Widget {
    let kind = "HabitChecklistWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitChecklistProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                HabitChecklistWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                HabitChecklistWidgetView(entry: entry)
                    .padding()
                    .background(Color(.systemBackground))
            }
        }
        .configurationDisplayName("Habit Checklist")
        .description("Today's habits with completion status")
        .supportedFamilies([.systemMedium])
    }
}
