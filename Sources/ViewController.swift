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
        webView.backgroundColor = UIColor(red: 0.04, green: 0.04, blue: 0.04, alpha: 1.0)
        webView.scrollView.backgroundColor = webView.backgroundColor
        
        view.addSubview(webView)
        
        // Загружаем локальные файлы
        guard let wwwPath = Bundle.main.path(forResource: "www", ofType: nil) else {
            showNativeError("Ошибка: папка 'www' не найдена в бандле.")
            return
        }
        let wwwURL = URL(fileURLWithPath: wwwPath)
        
        do {
            // 1. Читаем все три файла
            var htmlString = try String(contentsOf: wwwURL.appendingPathComponent("index.html"), encoding: .utf8)
            let cssString = try String(contentsOf: wwwURL.appendingPathComponent("style.css"), encoding: .utf8)
            let jsString = try String(contentsOf: wwwURL.appendingPathComponent("script.js"), encoding: .utf8)
            
            // 2. Вшиваем CSS и JS прямо в HTML
            htmlString = htmlString.replacingOccurrences(of: "<link rel=\"stylesheet\" href=\"style.css\">", with: "<style>\n\(cssString)\n</style>")
            htmlString = htmlString.replacingOccurrences(of: "<script src=\"script.js\"></script>", with: "<script>\n\(jsString)\n</script>")
            
            // 3. ГЛАВНЫЙ ТРЮК: Указываем фейковый адрес сервера, чтобы обойти CORS
            let fakeServerURL = URL(string: "https://95.81.95.42/")!
            webView.loadHTMLString(htmlString, baseURL: fakeServerURL)
            
        } catch {
            showNativeError("Ошибка чтения локальных файлов: \(error.localizedDescription)")
        }
    }
    
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
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let js = "showError('Ошибка WebView: \(error.localizedDescription.replacingOccurrences(of: "'", with: "\\'"))');"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }
    
    // Разрешаем подключение к серверу с самоподписанным сертификатом
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
