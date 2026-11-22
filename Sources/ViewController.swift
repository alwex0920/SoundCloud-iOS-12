import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate {
    
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.04, green: 0.04, blue: 0.04, alpha: 1.0) // Темный фон
        webView.scrollView.backgroundColor = webView.backgroundColor
        
        view.addSubview(webView)
        
        guard let wwwPath = Bundle.main.path(forResource: "www", ofType: nil) else {
            print("Ошибка: папка www не найдена в бандле.")
            return
        }
        let wwwURL = URL(fileURLWithPath: wwwPath)
        let indexPath = wwwURL.appendingPathComponent("index.html")
        
        do {
            let htmlString = try String(contentsOf: indexPath, encoding: .utf8)
            webView.loadHTMLString(htmlString, baseURL: wwwURL)
        } catch {
            print("Ошибка при чтении index.html: \(error)")
        }
    }
    
    // --- ВОТ ЭТОТ БЛОК РАЗРЕШАЕТ САМОПОДПИСАННЫЙ СЕРТИФИКАТ ---
    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        
        // Если сервер использует HTTPS и запрашивает проверку сертификата
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            if let serverTrust = challenge.protectionSpace.serverTrust {
                // Доверяем сертификату (ВНИМАНИЕ: в реальном AppStore так делать нельзя, но для личного клиента сойдет)
                let credential = URLCredential(trust: serverTrust)
                completionHandler(.useCredential, credential)
                return
            }
        }
        completionHandler(.performDefaultHandling, nil)
    }
}
