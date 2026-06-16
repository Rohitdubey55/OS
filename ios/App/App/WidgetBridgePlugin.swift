import Foundation
import UIKit
import WebKit
import WidgetKit

class WidgetBridgeHandler: NSObject, WKScriptMessageHandler {
    static let appGroupID = "group.com.personal.os"

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "widgetBridge" else { return }
        guard let jsonString = message.body as? String else {
            NSLog("[WidgetBridge] body is not a string")
            return
        }

        NSLog("[WidgetBridge] Received data (%d bytes)", jsonString.count)

        guard let defaults = UserDefaults(suiteName: WidgetBridgeHandler.appGroupID) else {
            NSLog("[WidgetBridge] Cannot access App Group: %@", WidgetBridgeHandler.appGroupID)
            return
        }

        defaults.set(jsonString, forKey: "widgetData")
        defaults.set(Date().timeIntervalSince1970, forKey: "widgetDataTimestamp")
        defaults.synchronize()

        NSLog("[WidgetBridge] Data written to UserDefaults")

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
            NSLog("[WidgetBridge] Reloaded all widget timelines")
        }
    }
}

// Inject the message handler into Capacitor's WKWebView
class WidgetBridgeInjector {
    static let handler = WidgetBridgeHandler()

    static func inject() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            guard let window = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap({ $0.windows })
                .first(where: { $0.isKeyWindow }),
                  let rootVC = window.rootViewController else {
                NSLog("[WidgetBridge] No root view controller found")
                return
            }

            // Find the WKWebView in the view hierarchy
            if let webView = findWebView(in: rootVC.view) {
                webView.configuration.userContentController.add(handler, name: "widgetBridge")
                NSLog("[WidgetBridge] Message handler registered on WKWebView")
            } else {
                NSLog("[WidgetBridge] WKWebView not found, retrying...")
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    if let webView = findWebView(in: rootVC.view) {
                        webView.configuration.userContentController.add(handler, name: "widgetBridge")
                        NSLog("[WidgetBridge] Message handler registered (retry)")
                    } else {
                        NSLog("[WidgetBridge] WKWebView still not found")
                    }
                }
            }
        }
    }

    static func findWebView(in view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView { return webView }
        for subview in view.subviews {
            if let found = findWebView(in: subview) { return found }
        }
        return nil
    }
}
