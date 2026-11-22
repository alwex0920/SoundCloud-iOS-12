import Foundation

struct SearchResponse: Codable {
    let collection: [Track]
}

struct Track: Codable {
    let id: Int
    let title: String
    let user: String
    let artworkUrl: String?
    let duration: Int
    
    // Связываем JSON-ключи (artwork_url) с переменными Swift (artworkUrl)
    enum CodingKeys: String, CodingKey {
        case id, title, user, duration
        case artworkUrl = "artwork_url"
    }
}
