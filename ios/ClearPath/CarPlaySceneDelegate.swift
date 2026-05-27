import CarPlay
import UIKit

/// Handles the CarPlay window lifecycle and delegates routing events
/// to the React Native CarPlayModule bridge.
@objc(CarPlaySceneDelegate)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

    var interfaceController: CPInterfaceController?
    var mapTemplate: CPMapTemplate?

    // MARK: - Scene lifecycle

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = interfaceController
        setupMapTemplate()
        CarPlayModule.shared.onConnected()
    }

    func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = nil
        self.mapTemplate = nil
        CarPlayModule.shared.onDisconnected()
    }

    // MARK: - Template setup

    private func setupMapTemplate() {
        let mapTemplate = CPMapTemplate()
        mapTemplate.mapDelegate = self
        self.mapTemplate = mapTemplate
        interfaceController?.setRootTemplate(mapTemplate, animated: false, completion: nil)
    }

    // MARK: - Trip / maneuver updates (called from CarPlayModule)

    func startTrip(
        destinationLabel: String,
        totalDistanceKm: Double,
        estimatedArrival: Date
    ) {
        guard let mapTemplate = mapTemplate else { return }

        let maneuver = CPManeuver()
        maneuver.instructionVariants = [destinationLabel]

        let estimate = CPTravelEstimates(
            distanceRemaining: Measurement(value: totalDistanceKm, unit: UnitLength.kilometers),
            timeRemaining: estimatedArrival.timeIntervalSinceNow
        )

        let destination = CPRouteChoice(summaryVariants: [destinationLabel], additionalInformationVariants: [], selectionSummaryVariants: [])
        let origin = MKMapItem.forCurrentLocation()
        let dest = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: 0, longitude: 0)))
        dest.name = destinationLabel

        let trip = CPTrip(origin: origin, destination: dest, routeChoices: [destination])
        trip.localizedName = "ClearPath Route"

        mapTemplate.startNavigationSession(for: trip)
    }

    func updateManeuver(instruction: String, distanceLabel: String) {
        guard let mapTemplate = mapTemplate else { return }
        let maneuver = CPManeuver()
        maneuver.instructionVariants = [instruction]
        mapTemplate.updateEstimates(
            CPTravelEstimates(
                distanceRemaining: Measurement(value: 0, unit: UnitLength.meters),
                timeRemaining: 0
            ),
            for: maneuver
        )
    }

    func endTrip() {
        mapTemplate?.cancelNavigation()
    }
}

// MARK: - CPMapTemplateDelegate

extension CarPlaySceneDelegate: CPMapTemplateDelegate {
    func mapTemplateDidBeginPanGesture(_ mapTemplate: CPMapTemplate) {}
    func mapTemplate(_ mapTemplate: CPMapTemplate, didUpdatePanGestureWithTranslation translation: CGPoint, velocity: CGPoint) {}
    func mapTemplate(_ mapTemplate: CPMapTemplate, didEndPanGestureWithVelocity velocity: CGPoint) {}
    func mapTemplate(_ mapTemplate: CPMapTemplate, didBeginPanningForNavigationAlert navigationAlert: CPNavigationAlert) {}
    func mapTemplate(_ mapTemplate: CPMapTemplate, didDismissPanningForNavigationAlert navigationAlert: CPNavigationAlert) {}
}
