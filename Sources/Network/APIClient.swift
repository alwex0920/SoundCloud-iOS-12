import Foundation

class APIClient {
    static let shared = APIClient()
    
    // IP твоего сервера
    private let baseURL = "https://95.81.95.42/api"
    
    func searchTracks(query: String, completion: @escaping (Result<[Track], Error>) -> Void) {
        guard let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(baseURL)/search?q=\(encodedQuery)") else {
            return
        }
        
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else { return }
            
            do {
                let response = try JSONDecoder().decode(SearchResponse.self, from: data)
                completion(.success(response.collection))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
    
    func getStreamURL(trackId: Int, completion: @escaping (String?) -> Void) {
        guard let url = URL(string: "\(baseURL)/stream/\(trackId)") else { return }
        
        let task = URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let streamUrl = json["url"] as? String else {
                completion(nil)
                return
            }
            completion(streamUrl)
        }
        task.resume()
    }
}
