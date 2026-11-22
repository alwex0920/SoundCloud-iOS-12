import UIKit

class MainTabBarController: UITabBarController {
    override func viewDidLoad() {
        super.viewDidLoad()
        
        tabBar.barTintColor = .black
        tabBar.tintColor = .white
        tabBar.unselectedItemTintColor = .gray
        
        let searchVC = ViewController()
        let likesVC = UIViewController()
        likesVC.view.backgroundColor = .black
        
        // Проверка версии iOS для иконок
        if #available(iOS 13.0, *) {
            searchVC.tabBarItem = UITabBarItem(title: "Поиск", image: UIImage(systemName: "magnifyingglass"), tag: 0)
            likesVC.tabBarItem = UITabBarItem(title: "Лайки", image: UIImage(systemName: "heart"), tag: 1)
        } else {
            searchVC.tabBarItem = UITabBarItem(title: "Поиск", image: nil, tag: 0)
            likesVC.tabBarItem = UITabBarItem(title: "Лайки", image: nil, tag: 1)
        }
        
        let nav1 = UINavigationController(rootViewController: searchVC)
        let nav2 = UINavigationController(rootViewController: likesVC)
        
        [nav1, nav2].forEach { nav in
            nav.navigationBar.barStyle = .black
            nav.navigationBar.tintColor = .white
        }
        
        viewControllers = [nav1, nav2]
    }
}
