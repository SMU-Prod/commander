package br.com.soumardivers.commander;

import android.os.Bundle;
import br.com.soumardivers.commander.nmea.NmeaSocketPlugin;
import com.getcapacitor.BridgeActivity;

/**
 * Onda 14 — registra o plugin nativo `NmeaSocket` (socket TCP/UDP pro
 * gateway WiFi NMEA 0183 do ecobatimetro; ver
 * `android/app/src/main/java/br/com/soumardivers/commander/nmea/`).
 *
 * `registerPlugin` PRECISA rodar antes de `super.onCreate` — e o
 * `super.onCreate` da `BridgeActivity` quem monta a Bridge e carrega a
 * lista de plugins registrados (`com.getcapacitor.BridgeActivity#load`),
 * chamado no fim do proprio `super.onCreate`.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NmeaSocketPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
