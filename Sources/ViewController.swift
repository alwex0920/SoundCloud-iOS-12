import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    
    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        // Добавляем мост для вызова входа из JS
        let contentController = WKUserContentController()
        contentController.add(self, name: "loginHandler")
        config.userContentController = contentController
        
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.04, green: 0.04, blue: 0.04, alpha: 1.0)
        webView.scrollView.backgroundColor = webView.backgroundColor
        
        view.addSubview(webView)
        loadLocalHTML()
    }
    
    // Загрузка локального HTML с "фейковым" базовым URL для обхода CORS
    func loadLocalHTML() {
        guard let wwwPath = Bundle.main.path(forResource: "www", ofType: nil) else { return }
        let wwwURL = URL(fileURLWithPath: wwwPath)
        
        do {
            var html = try String(contentsOf: wwwURL.appendingPathComponent("index.html"), encoding: .utf8)
            let css = try String(contentsOf: wwwURL.appendingPathComponent("style.css"), encoding: .utf8)
            let js = try String(contentsOf: wwwURL.appendingPathComponent("script.js"), encoding: .utf8)
            
            // Вшиваем CSS и JS прямо в HTML
            html = html.replacingOccurrences(of: "<link rel=\"stylesheet\" href=\"style.css\">", with: "<style>\n\(css)\n</style>")
            html = html.replacingOccurrences(of: "<script src=\"script.js\"></script>", with: "<script>\n\(js)\n</script>")
            
            // Загружаем с базовым URL сервера
            webView.loadHTMLString(html, baseURL: URL(string: "https://95.81.95.42/")!)
        } catch {
            print("Ошибка загрузки файлов: \(error)")
        }
    }
    
    // Получаем команду из JS (нажатие на кнопку "Войти")
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "loginHandler", let _ = message.body as? String {
            // Открываем страницу авторизации SoundCloud
            let authURL = "https://soundcloud.com/connect?client_id=QhVEWrrJKvW4uSU5u5EoI0FTXYUGzy5k&response_type=token&redirect_uri=sc-app://auth"
            if let url = URL(string: authURL) {
                webView.load(URLRequest(url: url))
            }
        }
    }
    
    // Перехватываем редирект sc-app://auth#access_token=...
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        
        if let url = navigationAction.request.url, url.scheme == "sc-app" {
            decisionHandler(.cancel)
            
            // Вытаскиваем токен из ссылки
            if let fragment = url.fragment {
                let params = fragment.components(separatedBy: "&")
                for param in params {
                    if param.hasPrefix("access_token=") {
                        let token = param.replacingOccurrences(of: "access_token=", with: "")
                        
                        // Передаем токен в JS
                        let jsCode = "window.saveToken('\(token)');"
                        webView.evaluateJavaScript(jsCode, completionHandler: { _, _ in
                            // Возвращаемся на главную страницу приложения
                            self.loadLocalHTML()
                        })
                        return
                    }
                }
            }
        }
        decisionHandler(.allow)
    }
    
    // Разрешаем самоподписанный сертификат
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
