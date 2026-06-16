import WidgetKit
import SwiftUI

struct HabitsProgressProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitsProgressEntry {
        HabitsProgressEntry(date: Date(), completed: 0, total: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (HabitsProgressEntry) -> Void) {
        let data = WidgetDataStore.load()?.habits ?? WidgetDataStore.sample.habits!
        completion(HabitsProgressEntry(date: Date(), completed: data.completed, total: data.total))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitsProgressEntry>) -> Void) {
        let widgetData = WidgetDataStore.load()
        let data = widgetData?.habits
        NSLog("[HabitsWidget] getTimeline called — data nil? %@, habits nil? %@, completed: %d, total: %d",
              widgetData == nil ? "YES" : "NO",
              data == nil ? "YES" : "NO",
              data?.completed ?? -1,
              data?.total ?? -1)
        let entry = HabitsProgressEntry(
            date: Date(),
            completed: data?.completed ?? 0,
            total: data?.total ?? 0
        )
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct HabitsProgressEntry: TimelineEntry {
    let date: Date
    let completed: Int
    let total: Int
}

struct HabitsProgressWidgetView: View {
    var entry: HabitsProgressEntry

    var progress: Double {
        guard entry.total > 0 else { return 0 }
        return Double(entry.completed) / Double(entry.total)
    }

    var body: some View {
        if #available(iOSApplicationExtension 16.0, *) {
            Gauge(value: progress) {
                Text("Habits")
            } currentValueLabel: {
                Text("\(entry.completed)/\(entry.total)")
                    .font(.system(.body, design: .rounded, weight: .bold))
            }
            .gaugeStyle(.accessoryCircular)
            .tint(progress >= 1.0 ? .green : .blue)
        }
    }
}

struct HabitsProgressWidget: Widget {
    let kind = "HabitsProgressWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitsProgressProvider()) { entry in
            HabitsProgressWidgetView(entry: entry)
        }
        .configurationDisplayName("Habits Progress")
        .description("Today's habit completion ring")
        .supportedFamilies([.accessoryCircular])
    }
}
