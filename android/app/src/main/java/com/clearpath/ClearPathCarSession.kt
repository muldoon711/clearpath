package com.clearpath

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.ScreenManager
import androidx.car.app.Session

class ClearPathCarSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen {
        AndroidAutoModule.instance?.onCarConnected()
        return ClearPathCarScreen(carContext)
    }

    override fun onCarAppFinished() {
        AndroidAutoModule.instance?.onCarDisconnected()
    }
}
