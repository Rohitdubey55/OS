import WidgetKit
import SwiftUI

struct TodaysTasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodaysTasksEntry {
        TodaysTasksEntry(date: Date(), tasks: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (TodaysTasksEntry) -> Void) {
        let tasks = WidgetDataStore.load()?.tasks ?? WidgetDataStore.sample.tasks!
        completion(TodaysTasksEntry(date: Date(), tasks: tasks))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodaysTasksEntry>) -> Void) {
        let tasks = WidgetDataStore.load()?.tasks ?? []
        let entry = TodaysTasksEntry(date: Date(), tasks: tasks)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct TodaysTasksEntry: TimelineEntry {
    let date: Date
    let tasks: [TaskItem]
}

struct TodaysTasksWidgetView: View {
    var entry: TodaysTasksEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Today's Tasks")
                    .font(.system(.headline, design: .rounded, weight: .bold))
                Spacer()
                Text("\(entry.tasks.filter { !$0.done }.count) left")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.bottom, 2)

            if entry.tasks.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 4) {
                        Text("✨").font(.title2)
                        Text("No tasks today").font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                }
                Spacer()
            } else {
                ForEach(entry.tasks.prefix(5)) { task in
                    HStack(spacing: 8) {
                        Circle().fill(Color.priorityColor(task.priority)).frame(width: 8, height: 8)
                        Text(task.title)
                            .font(.system(.caption, design: .rounded))
                            .strikethrough(task.done, color: .secondary)
                            .foregroundColor(task.done ? .secondary : .primary)
                            .lineLimit(1)
                        Spacer()
                        if task.done {
                            Image(systemName: "checkmark.circle.fill").font(.caption2).foregroundColor(.green)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding()
        .widgetURL(URL(string: "personalos://tasks"))
    }
}

struct TodaysTasksWidget: Widget {
    let kind = "TodaysTasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodaysTasksProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                TodaysTasksWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                TodaysTasksWidgetView(entry: entry)
                    .padding()
                    .background(Color(.systemBackground))
            }
        }
        .configurationDisplayName("Today's Tasks")
        .description("Your top priority tasks for today")
        .supportedFamilies([.systemMedium])
    }
}
