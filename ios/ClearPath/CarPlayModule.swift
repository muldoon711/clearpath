import Foundation
import CarPlay
import React

/// Exposes CarPlay connection events and navigation commands to JS via the RN bridge.
@objc(CarPlayModule)
class CarPlayModule: RCTEventEmitter {

    static let shared = CarPlayModule()
    private var sceneDelegate: CarPlaySceneDelegate?

    // MARK: - RCTEventEmitter

    override func supportedEvents() -> [String]! {
        return ["CarPlay:Connected", "CarPlay:Disconnected"]
    }

    override static func requiresMainQueueSetup() -> Bool { true }

    // MARK: - Called from CarPlaySceneDelegate

    func onConnected() {
        sendEvent(withName: "CarPlay:Connected", body: nil)
    }

    func onDisconnected() {
        sendEvent(withName: "CarPlay:Disconnected", body: nil)
    }

    // MARK: - JS-callable methods

    @objc func startTrip(_ params: NSDictionary) {
        DispatchQueue.main.async {
            guard let delegate = self.findSceneDelegate() else { return }
            let dest = params["destinationLabel"] as? String ?? "Destination"
            let distKm = params["totalDistanceKm"] as? Double ?? 0
            let arrival = params["estimatedArrival"] as? String ?? ""
            let arrivalDate = ISO8601DateFormatter().date(from: arrival) ?? Date().addingTimeInterval(3600)
            delegate.startTrip(destinationLabel: dest, totalDistanceKm: distKm, estimatedArrival: arrivalDate)
        }
    }

    @objc func updateManeuver(_ params: NSDictionary) {
        DispatchQueue.main.async {
            guard let delegate = self.findSceneDelegate() else { return }
            let instruction = params["instruction"] as? String ?? ""
            let distLabel = params["distanceLabel"] as? String ?? ""
            delegate.updateManeuver(instruction: instruction, distanceLabel: distLabel)
        }
    }

    @objc func endTrip() {
        DispatchQueue.main.async {
            self.findSceneDelegate()?.endTrip()
        }
    }

    @objc func updateMapCenter(_ params: NSDictionary) {
        // Map center sync — handled by MapLibre's CarPlay window
    }

    private func findSceneDelegate() -> CarPlaySceneDelegate? {
        UIApplication.shared.connectedScenes
            .compactMap { $0.delegate as? CarPlaySceneDelegate }
            .first
    }
}
