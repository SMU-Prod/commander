package br.com.soumardivers.commander.nmea;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Onda 14 — ponte JS &lt;-&gt; {@link NmeaSocketWorker}.
 *
 * Fica fino de proposito: toda a logica de socket (thread separada, TCP,
 * UDP, reconexao) mora em {@link NmeaSocketWorker}; esta classe so traduz
 * chamadas do lado JS (`web/lib/nmea/nativo-capacitor.ts`, via o wrapper
 * `web/lib/nmea/nmea-socket-plugin.ts`) pros metodos do worker, e repassa
 * os eventos "linha"/"status" de volta pro JS via {@code notifyListeners}.
 *
 * Nao pede nenhuma "permission" no sentido do {@code @CapacitorPlugin}
 * (runtime permission dialog) porque INTERNET/ACCESS_WIFI_STATE/
 * ACCESS_NETWORK_STATE/CHANGE_WIFI_MULTICAST_STATE sao todas permissoes de
 * INSTALACAO (normais), nao as perigosas que pedem prompt em runtime — ver
 * `AndroidManifest.xml`.
 */
@CapacitorPlugin(name = "NmeaSocket")
public class NmeaSocketPlugin extends Plugin implements NmeaSocketWorker.Ouvinte {

    private NmeaSocketWorker worker;

    @Override
    public void load() {
        worker = new NmeaSocketWorker(this);
    }

    /**
     * `conectar({ modo: "tcp" | "udp", host?, porta? })` — ver
     * `web/lib/nmea/nmea-socket-plugin.ts` pro tipo TS espelhado. Resolve
     * assim que a thread de socket comeca (nao espera a conexao de fato
     * abrir — isso vem depois via evento "status"; ver
     * `NmeaSocketWorker#loopTcp`/`#loopUdp`).
     */
    @PluginMethod
    public void conectar(PluginCall call) {
        String modo = call.getString("modo", "udp");
        String host = call.getString("host");
        Integer porta = call.getInt("porta", NmeaSocketWorker.PORTA_PADRAO);

        if ("tcp".equals(modo) && (host == null || host.isEmpty())) {
            call.reject("Modo 'tcp' exige 'host' (IP do gateway NMEA na rede do barco).");
            return;
        }
        if (porta == null || porta <= 0 || porta > 65535) {
            call.reject("Porta invalida: " + porta);
            return;
        }

        worker.conectar(modo, host, porta);
        call.resolve();
    }

    @PluginMethod
    public void desconectar(PluginCall call) {
        worker.desconectar();
        call.resolve();
    }

    @Override
    public void aoReceberLinha(String linha) {
        JSObject dados = new JSObject();
        dados.put("linha", linha);
        notifyListeners("linha", dados);
    }

    @Override
    public void aoMudarStatus(String status, String mensagem) {
        JSObject dados = new JSObject();
        dados.put("status", status);
        if (mensagem != null) {
            dados.put("mensagem", mensagem);
        }
        notifyListeners("status", dados);
    }

    /**
     * Liberacao limpa no destroy (Activity sendo destruida de verdade —
     * processo indo embora): fecha socket e mata a thread. Deliberadamente
     * NAO paramos em {@code handleOnPause} (tela apagar/trocar de app por
     * um instante nao deveria cortar a coleta de sondagem) — ver nota em
     * `docs/APP-NATIVO.md` sobre o limite disso sem um foreground service
     * (o Android pode suspender a thread depois de alguns minutos em
     * segundo plano de qualquer forma).
     */
    @Override
    protected void handleOnDestroy() {
        if (worker != null) {
            worker.desconectar();
        }
        super.handleOnDestroy();
    }
}
