package com.clearpath

import android.content.Intent
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.model.*
import androidx.car.app.navigation.NavigationManager
import androidx.car.app.navigation.model.*
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native bridge module that connects the JS navigation state to
 * the Android Auto Car App Library.
 *
 * The native AndroidAutoSession (registered in the manifest) calls back
 * into this module to drive the CarScreen state machine.
 */
class AndroidAutoModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AndroidAutoModule"

    private var navigationManager: NavigationManager? = null
    private var isNavigating = false

    // ── Called from JS ────────────────────────────────────────────────────────

    @ReactMethod
    fun startNavigation(params: ReadableMap) {
        val destinationLat = params.getDouble("destinationLat")
        val destinationLng = params.getDouble("destinationLng")
        val totalDistanceMeters = params.getDouble("totalDistanceMeters")
        val totalDurationSeconds = params.getDouble("totalDurationSeconds")

        isNavigating = true
        sendEvent("AndroidAuto:NavigationStarted", null)
    }

    @ReactMethod
    fun sendStep(params: ReadableMap) {
        if (!isNavigating) return
        val instruction = params.getString("instruction") ?: return
        val distanceLabel = params.getString("distanceLabel") ?: ""
        val maneuverType = params.getString("maneuverType") ?: "continue"
        // The CarScreen (see AndroidAutoCarScreen) reads these via the module singleton
        currentStep = StepData(instruction, distanceLabel, mapManeuver(maneuverType))
        sendEvent("AndroidAuto:StepUpdated", null)
    }

    @ReactMethod
    fun stopNavigation() {
        isNavigating = false
        currentStep = null
        sendEvent("AndroidAuto:NavigationStopped", null)
    }

    // ── Called from native AndroidAutoSession ─────────────────────────────────

    fun onCarConnected() {
        sendEvent("AndroidAuto:Connected", null)
    }

    fun onCarDisconnected() {
        sendEvent("AndroidAuto:Disconnected", null)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun sendEvent(event: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, params)
    }

    private fun mapManeuver(type: String): Maneuver.Type = when (type) {
        "left" -> Maneuver.TYPE_TURN_NORMAL_LEFT
        "right" -> Maneuver.TYPE_TURN_NORMAL_RIGHT
        "slight_left" -> Maneuver.TYPE_TURN_SLIGHT_LEFT
        "slight_right" -> Maneuver.TYPE_TURN_SLIGHT_RIGHT
        "sharp_left" -> Maneuver.TYPE_TURN_SHARP_LEFT
        "sharp_right" -> Maneuver.TYPE_TURN_SHARP_RIGHT
        "u_turn_left" -> Maneuver.TYPE_U_TURN_LEFT
        "u_turn_right" -> Maneuver.TYPE_U_TURN_RIGHT
        "roundabout_enter" -> Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CW
        "destination" -> Maneuver.TYPE_DESTINATION
        else -> Maneuver.TYPE_STRAIGHT
    }

    data class StepData(
        val instruction: String,
        val distanceLabel: String,
        val maneuverType: Maneuver.Type,
    )

    companion object {
        var currentStep: StepData? = null
        var instance: AndroidAutoModule? = null
    }

    init {
        instance = this
    }
}
