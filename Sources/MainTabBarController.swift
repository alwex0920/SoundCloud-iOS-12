import UIKit

class MainTabBarController: UITabBarController {
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Настраиваем внешний вид вкладок (можно стилизовать под Glass-дизайн)
        tabBar.barTintColor = .black
        tabBar.tintColor = .white
        tabBar.unselectedItemTintColor = .gray
        
        // Вкладка 1: Поиск
        let searchVC = ViewController()
        searchVC.tabBarItem = UITabBarItem(title: "Поиск", image: UIImage(systemName: "magnifyingglass"), tag: 0)
        
        // Вкладка 2: Лайки (пока заглушка)
        let likesVC = UIViewController()
        likesVC.view.backgroundColor = .black
        likesVC.tabBarItem = UITabBarItem(title: "Лайки", image: UIImage(systemName: "heart"), tag: 1)
        
        // Добавляем навигационные контроллеры, чтобы сверху был заголовок
        let nav1 = UINavigationController(rootViewController: searchVC)
        let nav2 = UINavigationController(rootViewController: likesVC)
        
        // Настраиваем навигацию под темную тему
        [nav1, nav2].forEach { nav in
            nav.navigationBar.barStyle = .black
            nav.navigationBar.tintColor = .white
        }
        
        viewControllers = [nav1, nav2]
    }
}
