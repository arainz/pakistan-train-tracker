import Capacitor
import WebKit

extension CAPBridgeViewController {
    
    open override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        // Enable swipe-back gesture for WKWebView after view appears
        if let webView = self.webView {
            webView.allowsBackForwardNavigationGestures = true
            print("✅ iOS swipe-back navigation enabled for WKWebView")
        } else {
            print("⚠️ Could not access webView to enable swipe gestures")
        }
    }
}

