import SwiftUI

struct CircularProgressView: View {
    let progress: Double
    let lineWidth: CGFloat
    let trackColor: Color
    let progressColor: Color

    init(progress: Double, lineWidth: CGFloat = 6, trackColor: Color = Color.gray.opacity(0.3), progressColor: Color = .blue) {
        self.progress = min(1.0, max(0.0, progress))
        self.lineWidth = lineWidth
        self.trackColor = trackColor
        self.progressColor = progressColor
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
            Circle()
                .trim(from: 0, to: progress)
                .stroke(progressColor, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

extension Color {
    static func budgetColor(spent: Int, budget: Int) -> Color {
        guard budget > 0 else { return .gray }
        let ratio = Double(spent) / Double(budget)
        if ratio > 1.0 { return .red }
        if ratio > 0.8 { return .orange }
        return .green
    }

    static func priorityColor(_ priority: String) -> Color {
        switch priority {
        case "P1": return .red
        case "P2": return .orange
        case "P3": return .green
        default: return .gray
        }
    }
}
