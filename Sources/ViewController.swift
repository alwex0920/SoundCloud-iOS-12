import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate {
    
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        // --- ГЛАВНЫЙ ФИКС ДЛЯ CORS НА iOS 12 ---
        // Разрешаем локальному файлу делать запросы к внешним серверам
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        config.setValue(true, forKey: "allowFileAccessFromFileURLs")
        
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.04, green: 0.04, blue: 0.04, alpha: 1.0)
        webView.scrollView.backgroundColor = webView.backgroundColor
        
        view.addSubview(webView)
        
        // Проверяем наличие папки www
        guard let wwwPath = Bundle.main.path(forResource: "www", ofType: nil) else {
            showNativeError("Ошибка: папка 'www' не найдена в бандле приложения.")
            return
        }
        let wwwURL = URL(fileURLWithPath: wwwPath)
        let indexPath = wwwURL.appendingPathComponent("index.html")
        
        // Проверяем наличие index.html
        if !FileManager.default.fileExists(atPath: indexPath.path) {
            showNativeError("Ошибка: файл 'index.html' не найден по пути: \(indexPath.path)")
            return
        }
        
        // Загружаем HTML
        do {
            let htmlString = try String(contentsOf: indexPath, encoding: .utf8)
            webView.loadHTMLString(htmlString, baseURL: wwwURL)
        } catch {
            showNativeError("Ошибка чтения index.html: \(error.localizedDescription)")
        }
    }
    
    // Вывод нативной ошибки, если WebView вообще не загрузился
    func showNativeError(_ message: String) {
        let errorLabel = UILabel()
        errorLabel.text = "CRITICAL ERROR:\n\n" + message
        errorLabel.textColor = .white
        errorLabel.backgroundColor = .red
        errorLabel.numberOfLines = 0
        errorLabel.textAlignment = .center
        errorLabel.frame = view.bounds
        view.addSubview(errorLabel)
    }
    
    // Если WebView упал во время загрузки страницы
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let js = "showError('Ошибка загрузки WebView: \(error.localizedDescription.replacingOccurrences(of: "'", with: "\\'"))');"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }
    
    // Доверие самоподписанному сертификату (чтобы запросы к серверу не блокировались)
    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            if let serverTrust = challenge.protectionSpace.serverTrust {
                let credential = URLCredential(trust: serverTrust)
                completionHandler(.useCredential, credential)
                return
            }
        }
        completionHandler(.performDefaultHandling, nil)
    }
}
