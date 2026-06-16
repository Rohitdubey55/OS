import WidgetKit
import SwiftUI

struct ReadingStatsProvider: TimelineProvider {
    func placeholder(in context: Context) -> ReadingStatsEntry {
        ReadingStatsEntry(date: Date(), data: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (ReadingStatsEntry) -> Void) {
        let data = WidgetDataStore.load()?.reading ?? WidgetDataStore.sample.reading
        completion(ReadingStatsEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ReadingStatsEntry>) -> Void) {
        let data = WidgetDataStore.load()?.reading
        let entry = ReadingStatsEntry(date: Date(), data: data)
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

struct ReadingStatsEntry: TimelineEntry {
    let date: Date
    let data: ReadingData?
}

struct ReadingStatsWidgetView: View {
    var entry: ReadingStatsEntry

    var body: some View {
        let r = entry.data
        let hasBook = !(r?.currentBook.isEmpty ?? true)

        VStack(spacing: 6) {
            if hasBook {
                Text("📖").font(.title2)
                Text(r!.currentBook)
                    .font(.system(.caption, design: .rounded, weight: .bold))
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                Text(r!.author)
                    .font(.system(size: 9, design: .rounded))
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 6)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.blue)
                            .frame(width: geo.size.width * CGFloat(r!.percentage) / 100.0, height: 6)
                    }
                }.frame(height: 6)

                Text("p.\(r!.currentPage) of \(r!.totalPages) · \(r!.percentage)%")
                    .font(.system(size: 9, design: .rounded))
                    .foregroundColor(.secondary)
            } else {
                Spacer()
                Text("📚").font(.largeTitle)
                Text("No book").font(.caption).foregroundColor(.secondary)
                Text("Start reading!").font(.system(size: 9)).foregroundColor(.secondary)
                Spacer()
            }
        }
        .padding()
        .widgetURL(URL(string: "personalos://books"))
    }
}

struct ReadingStatsWidget: Widget {
    let kind = "ReadingStatsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ReadingStatsProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                ReadingStatsWidgetView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                ReadingStatsWidgetView(entry: entry)
                    .padding()
                    .background(Color(.systemBackground))
            }
        }
        .configurationDisplayName("Reading Stats")
        .description("Currently reading book with progress")
        .supportedFamilies([.systemSmall])
    }
}
