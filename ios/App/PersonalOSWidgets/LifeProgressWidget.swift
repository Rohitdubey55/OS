import WidgetKit
import SwiftUI

struct LifeProgressProvider: TimelineProvider {
    func placeholder(in context: Context) -> LifeProgressEntry {
        LifeProgressEntry(date: Date(), data: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (LifeProgressEntry) -> Void) {
        let data = WidgetDataStore.load()?.lifeProgress ?? WidgetDataStore.sample.lifeProgress
        completion(LifeProgressEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LifeProgressEntry>) -> Void) {
        let data = WidgetDataStore.load()?.lifeProgress
        let entry = LifeProgressEntry(date: Date(), data: data)
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct LifeProgressEntry: TimelineEntry {
    let date: Date
    let data: LifeProgressData?
}

struct LifeProgressWidgetView: View {
    var entry: LifeProgressEntry

    var body: some View {
        let life = entry.data
        let pct = Double(life?.percentage ?? 0) / 100.0

        VStack(spacing: 6) {
            ZStack {
                CircularProgressView(
                    progress: pct, lineWidth: 8,
                    trackColor: Color.gray.opacity(0.2),
                    progressColor: progressColor(pct)
                ).frame(width: 70, height: 70)

                VStack(spacing: 0) {
                    Text("\(life?.percentage ?? 0)%")
                        .font(.system(.title3, design: .rounded, weight: .bold))
                        .foregroundColor(.primary)
                    Text("lived")
                        .font(.system(size: 9, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)
                }
            }

            if let age = life?.ageYears {
                Text("Age \(age)")
                    .font(.system(.caption2, design: .rounded, weight: .medium))
                    .foregroundColor(.secondary)
            } else {
                Text("Set DOB in Settings")
                    .font(.system(size: 8, design: .rounded))
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .widgetURL(URL(string: "personalos://life-calendar"))
    }

    func progressColor(_ pct: Double) -> Color {
        if pct < 0.25 { return .green }
        if pct < 0.50 { return .blue }
        if pct < 0.75 { return .orange }
        return .red
    }
}

struct LifeProgressWidget: Widget {
    let kind = "LifeProgressWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LifeProgressProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                LifeProgressWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                LifeProgressWidgetView(entry: entry)
                    .padding()
                    .background(Color(.systemBackground))
            }
        }
        .configurationDisplayName("Life Progress")
        .description("Memento Mori — how much of your life has passed")
        .supportedFamilies([.systemSmall])
    }
}
