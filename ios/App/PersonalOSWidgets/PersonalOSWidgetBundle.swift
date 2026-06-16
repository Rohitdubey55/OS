import WidgetKit
import SwiftUI

@main
struct PersonalOSWidgetBundle: WidgetBundle {
    var body: some Widget {
        HabitsProgressWidget()
        TodaysTasksWidget()
        LifeProgressWidget()
        HabitChecklistWidget()
        WeeklyBudgetWidget()
        ReadingStatsWidget()
    }
}
