import UIKit
import AVFoundation

class ViewController: UIViewController, UITableViewDataSource, UITableViewDelegate, UISearchBarDelegate {
    
    let searchBar = UISearchBar()
    let tableView = UITableView()
    let miniPlayer = MiniPlayerView()
    let spinner = UIActivityIndicatorView(style: .gray)
    
    var tracks: [Track] = []
    var audioPlayer: AVPlayer?
    
    // Кэш для обложек
    let imageCache = NSCache<NSString, UIImage>()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        setupUI()
    }
    
    func setupUI() {
        searchBar.delegate = self
        searchBar.placeholder = "Поиск (например: Daft Punk)"
        searchBar.returnKeyType = .search // Кнопка "Поиск" на клавиатуре
        
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(TrackCell.self, forCellReuseIdentifier: "TrackCell")
        tableView.keyboardDismissMode = .onDrag
        
        spinner.hidesWhenStopped = true
        
        // Отключаем автоматические констрейнты для всех элементов
        searchBar.translatesAutoresizingMaskIntoConstraints = false
        tableView.translatesAutoresizingMaskIntoConstraints = false
        miniPlayer.translatesAutoresizingMaskIntoConstraints = false
        spinner.translatesAutoresizingMaskIntoConstraints = false
        
        // Добавляем элементы на экран
        view.addSubview(searchBar)
        view.addSubview(tableView)
        view.addSubview(miniPlayer)
        view.addSubview(spinner)
        
        // Включаем констрейнты
        NSLayoutConstraint.activate([
            searchBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            searchBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            searchBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            
            // Привязываем низ таблицы к верху плеера
            tableView.topAnchor.constraint(equalTo: searchBar.bottomAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: miniPlayer.topAnchor),
            
            // Настройки мини-плеера
            miniPlayer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            miniPlayer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            miniPlayer.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            miniPlayer.heightAnchor.constraint(equalToConstant: 60),
            
            // Спиннер по центру
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
    
    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        searchBar.resignFirstResponder()
        guard let query = searchBar.text, !query.isEmpty else { return }
        
        spinner.startAnimating()
        searchBar.isUserInteractionEnabled = false
        
        APIClient.shared.searchTracks(query: query) { [weak self] result in
            DispatchQueue.main.async {
                self?.spinner.stopAnimating()
                self?.searchBar.isUserInteractionEnabled = true
                
                switch result {
                case .success(let fetchedTracks):
                    self?.tracks = fetchedTracks
                    self?.tableView.reloadData()
                case .failure(let error):
                    print("Ошибка поиска: \(error)")
                }
            }
        }
    }
    
    // MARK: - TableView
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return tracks.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "TrackCell", for: indexPath) as! TrackCell
        let track = tracks[indexPath.row]
        
        cell.titleLabel.text = track.title
        cell.artistLabel.text = track.user
        cell.artworkImageView.image = nil
        
        // Загрузка с кэшем
        if let artworkUrlString = track.artworkUrl, let url = URL(string: artworkUrlString) {
            let cacheKey = artworkUrlString as NSString
            if let cachedImage = imageCache.object(forKey: cacheKey) {
                cell.artworkImageView.image = cachedImage
            } else {
                URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                    if let data = data, let image = UIImage(data: data) {
                        self?.imageCache.setObject(image, forKey: cacheKey)
                        DispatchQueue.main.async {
                            if tableView.indexPath(for: cell) == indexPath {
                                cell.artworkImageView.image = image
                            }
                        }
                    }
                }.resume()
            }
        } else {
            cell.artworkImageView.image = UIImage(systemName: "music.note")
            cell.artworkImageView.tintColor = .lightGray
            cell.artworkImageView.contentMode = .center
        }
        
        return cell
    }
    
    // MARK: - Воспроизведение
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let track = tracks[indexPath.row]
        
        APIClient.shared.getStreamURL(trackId: track.id) { [weak self] streamUrlString in
            guard let streamUrlString = streamUrlString, let url = URL(string: streamUrlString) else {
                print("Не удалось получить ссылку на стрим")
                return
            }
            
            DispatchQueue.main.async {
                self?.audioPlayer = AVPlayer(url: url)
                self?.audioPlayer?.play()
                self?.miniPlayer.updateTrack(track, player: self!.audioPlayer!)
            }
        }
    }
}
