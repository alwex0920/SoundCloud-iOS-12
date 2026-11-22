import UIKit
import AVFoundation

class ViewController: UIViewController, UITableViewDataSource, UITableViewDelegate, UISearchBarDelegate {
    
    let searchBar = UISearchBar()
    let tableView = UITableView()
    
    var tracks: [Track] = []
    var audioPlayer: AVPlayer?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        setupUI()
    }
    
    func setupUI() {
        searchBar.delegate = self
        searchBar.placeholder = "Поиск (например: Daft Punk)"
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(TrackCell.self, forCellReuseIdentifier: "TrackCell")
        
        searchBar.translatesAutoresizingMaskIntoConstraints = false
        tableView.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(searchBar)
        view.addSubview(tableView)
        
        NSLayoutConstraint.activate([
            searchBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            searchBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            searchBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            
            tableView.topAnchor.constraint(equalTo: searchBar.bottomAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        searchBar.resignFirstResponder()
        guard let query = searchBar.text, !query.isEmpty else { return }
        
        APIClient.shared.searchTracks(query: query) { [weak self] result in
            DispatchQueue.main.async {
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
        
        // Простая асинхронная загрузка обложки
        if let artworkUrlString = track.artworkUrl, let url = URL(string: artworkUrlString) {
            URLSession.shared.dataTask(with: url) { data, _, _ in
                if let data = data, let image = UIImage(data: data) {
                    DispatchQueue.main.async {
                        // Проверяем, что ячейка еще показывает этот трек
                        if tableView.indexPath(for: cell) == indexPath {
                            cell.artworkImageView.image = image
                        }
                    }
                }
            }.resume()
        } else {
            cell.artworkImageView.image = nil
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
                // Настраиваем аудио-плеер
                self?.audioPlayer = AVPlayer(url: url)
                self?.audioPlayer?.play()
                print("Играет: \(track.title)")
            }
        }
    }
}
