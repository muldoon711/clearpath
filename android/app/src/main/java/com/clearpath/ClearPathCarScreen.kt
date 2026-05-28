package com.clearpath

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.*
import androidx.car.app.navigation.model.*

class ClearPathCarScreen(carContext: CarContext) : Screen(carContext) {

    override fun onGetTemplate(): Template {
        val step = AndroidAutoModule.currentStep
        return if (step != null) {
            val maneuver = Maneuver.Builder(step.maneuverType).build()
            val navStep = Step.Builder(step.instruction)
                .setManeuver(maneuver)
                .setRoad(step.distanceLabel)
                .build()
            NavigationTemplate.Builder()
                .setNavigationInfo(
                    RoutingInfo.Builder()
                        .setCurrentStep(navStep, Distance.create(0.0, Distance.UNIT_METERS))
                        .build()
                )
                .setActionStrip(
                    ActionStrip.Builder()
                        .addAction(Action.BACK)
                        .build()
                )
                .build()
        } else {
            NavigationTemplate.Builder()
                .setActionStrip(ActionStrip.Builder().addAction(Action.BACK).build())
                .build()
        }
    }
}
