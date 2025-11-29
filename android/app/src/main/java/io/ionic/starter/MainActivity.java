package io.ionic.starter;

import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Establecer el color de fondo ANTES de llamar a super.onCreate
        getWindow().setBackgroundDrawableResource(R.color.splash_background);
        getWindow().getDecorView().setBackgroundColor(ContextCompat.getColor(this, R.color.splash_background));
        
        super.onCreate(savedInstanceState);
        
        // Mantener el color durante la transición
        getWindow().setStatusBarColor(ContextCompat.getColor(this, R.color.splash_background));
        getWindow().setNavigationBarColor(ContextCompat.getColor(this, R.color.splash_background));
    }
}
