package br.com.soumardivers.commander.nmea;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.util.Log;
import com.getcapacitor.Plugin;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Onda 14 — cliente TCP e listener UDP (broadcast) pra um gateway WiFi
 * NMEA 0183. Toda leitura de socket roda numa thread dedicada, NUNCA na
 * main thread (I/O bloqueante travaria a UI).
 *
 * Porta e modo padrao: a IANA registrou 10110/tcp e 10110/udp pro servico
 * "nmea-0183" (https://www.iana.org/assignments/service-names-port-numbers)
 * e essa e a porta que a maioria dos gateways WiFi NMEA recreativos
 * (Yacht Devices, Digital Yacht, Actisense, Vesper) usa por padrao — em
 * UDP quase sempre como BROADCAST na rede do barco (o app so precisa
 * escutar, nao precisa saber o IP do gateway), com TCP como alternativa
 * ponto-a-ponto pra quem prefere (aí sim precisa do IP do gateway). Alguns
 * fabricantes usam portas proprias (2000, 39150, 60001) — por isso a porta
 * NUNCA fica hardcoded fora de {@link #PORTA_PADRAO} como default, e
 * `conectar()` sempre aceita sobrescrever.
 */
final class NmeaSocketWorker {

    interface Ouvinte {
        void aoReceberLinha(String linha);

        /** status: "conectando" | "conectado" | "desconectado" | "erro" */
        void aoMudarStatus(String status, String mensagem);
    }

    static final int PORTA_PADRAO = 10110;

    private static final String TAG = "NmeaSocketWorker";
    private static final long RECONEXAO_BASE_MS = 1000;
    private static final long RECONEXAO_MAXIMA_MS = 30_000;
    /** Sem nenhuma linha (TCP) ou pacote (UDP) nesse intervalo, o socket
     *  reavalia se ainda vale a pena esperar — ver uso em cada loop. */
    private static final int TIMEOUT_LEITURA_MS = 15_000;

    private final Plugin plugin;
    private final Ouvinte ouvinte;
    private final AtomicBoolean rodando = new AtomicBoolean(false);

    private Thread thread;
    private volatile Socket socketTcp;
    private volatile DatagramSocket socketUdp;
    private volatile WifiManager.MulticastLock multicastLock;

    NmeaSocketWorker(Plugin plugin) {
        this.plugin = plugin;
        this.ouvinte = (Ouvinte) plugin;
    }

    /** Encerra qualquer worker anterior e sobe um novo — chamar de novo
     *  com parametros diferentes troca de gateway/modo sem precisar de
     *  dois `desconectar`/`conectar` manuais do lado JS. */
    void conectar(String modo, String host, int porta) {
        pararThread();
        rodando.set(true);
        boolean tcp = "tcp".equals(modo);
        thread = new Thread(
            () -> {
                if (tcp) {
                    loopTcp(host, porta);
                } else {
                    loopUdp(porta);
                }
            },
            "nmea-socket-worker"
        );
        thread.setDaemon(true);
        thread.start();
    }

    void desconectar() {
        boolean estavaRodando = rodando.get();
        pararThread();
        if (estavaRodando) {
            ouvinte.aoMudarStatus("desconectado", null);
        }
    }

    private void pararThread() {
        rodando.set(false);
        fecharSockets();
        Thread t = thread;
        if (t != null) {
            t.interrupt();
            thread = null;
        }
    }

    private void fecharSockets() {
        Socket tcp = socketTcp;
        if (tcp != null) {
            try {
                tcp.close();
            } catch (IOException ignored) {
                // socket ja fechado/quebrado — e exatamente o que queremos
            }
            socketTcp = null;
        }
        DatagramSocket udp = socketUdp;
        if (udp != null) {
            udp.close();
            socketUdp = null;
        }
        liberarMulticastLock();
    }

    private void liberarMulticastLock() {
        WifiManager.MulticastLock lock = multicastLock;
        if (lock != null && lock.isHeld()) {
            lock.release();
        }
        multicastLock = null;
    }

    // -----------------------------------------------------------------
    // TCP — cliente conectando no IP:porta do gateway.
    // -----------------------------------------------------------------

    private void loopTcp(String host, int porta) {
        int tentativa = 0;
        while (rodando.get()) {
            try {
                ouvinte.aoMudarStatus("conectando", null);
                Socket socket = new Socket();
                socketTcp = socket;
                socket.connect(new InetSocketAddress(host, porta), 10_000);
                socket.setSoTimeout(TIMEOUT_LEITURA_MS);
                tentativa = 0;
                ouvinte.aoMudarStatus("conectado", null);

                BufferedReader leitor = new BufferedReader(
                    new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII)
                );
                String linha;
                while (rodando.get() && (linha = leitor.readLine()) != null) {
                    if (!linha.isEmpty()) {
                        ouvinte.aoReceberLinha(linha);
                    }
                }
                // readLine devolveu null: o gateway fechou a conexao do
                // lado dele — cai pro finally/reconexao como se fosse erro.
                if (rodando.get()) {
                    throw new IOException("Gateway fechou a conexao TCP.");
                }
            } catch (IOException e) {
                if (!rodando.get()) {
                    break;
                }
                Log.w(TAG, "TCP: " + e.getMessage());
                ouvinte.aoMudarStatus("erro", e.getMessage());
            } finally {
                Socket tcp = socketTcp;
                if (tcp != null) {
                    try {
                        tcp.close();
                    } catch (IOException ignored) {}
                    socketTcp = null;
                }
            }
            if (!rodando.get()) {
                break;
            }
            tentativa = aguardarReconexao(tentativa);
        }
    }

    // -----------------------------------------------------------------
    // UDP — listener de broadcast, sem IP de destino: qualquer datagrama
    // que chegar nesta porta (unicast ou broadcast) e tratado como linha
    // NMEA. Nao ha "conexao" em UDP; erro aqui e sempre problema do
    // proprio socket/interface de rede (ex.: WiFi trocou), nao do gateway.
    // -----------------------------------------------------------------

    private void loopUdp(int porta) {
        int tentativa = 0;
        while (rodando.get()) {
            try {
                ouvinte.aoMudarStatus("conectando", null);
                DatagramSocket socket = new DatagramSocket(null);
                socket.setReuseAddress(true);
                socket.bind(new InetSocketAddress(porta));
                socket.setBroadcast(true);
                socket.setSoTimeout(TIMEOUT_LEITURA_MS);
                socketUdp = socket;
                adquirirMulticastLock();

                tentativa = 0;
                ouvinte.aoMudarStatus("conectado", null);

                byte[] buffer = new byte[2048];
                while (rodando.get()) {
                    DatagramPacket pacote = new DatagramPacket(buffer, buffer.length);
                    try {
                        socket.receive(pacote);
                    } catch (SocketTimeoutException semDados) {
                        // 15s sem nenhum pacote (ex.: gateway/ecobatimetro
                        // desligado com o barco fundeado) NAO e erro de
                        // socket — continua escutando no mesmo bind, sem
                        // reconectar (nao ha o que reconectar em UDP).
                        continue;
                    }
                    String texto = new String(
                        pacote.getData(),
                        pacote.getOffset(),
                        pacote.getLength(),
                        StandardCharsets.US_ASCII
                    );
                    // Normalmente 1 sentenca por datagrama, mas alguns
                    // gateways enfileiram varias linhas no mesmo pacote.
                    for (String linha : texto.split("\r\n|\n|\r")) {
                        if (!linha.isEmpty()) {
                            ouvinte.aoReceberLinha(linha);
                        }
                    }
                }
            } catch (IOException e) {
                if (!rodando.get()) {
                    break;
                }
                Log.w(TAG, "UDP: " + e.getMessage());
                ouvinte.aoMudarStatus("erro", e.getMessage());
            } finally {
                DatagramSocket udp = socketUdp;
                if (udp != null) {
                    udp.close();
                    socketUdp = null;
                }
                liberarMulticastLock();
            }
            if (!rodando.get()) {
                break;
            }
            tentativa = aguardarReconexao(tentativa);
        }
    }

    /** Sem isso, alguns aparelhos param de entregar pacotes broadcast pro
     *  app assim que o WiFi entra em modo de economia de energia (tela
     *  apagada) — o multicast lock evita esse corte especificamente pra
     *  trafego multicast/broadcast. Exige `CHANGE_WIFI_MULTICAST_STATE`
     *  no manifest (ver `AndroidManifest.xml`); sem a permissao, degrada
     *  em silencio (broadcast comum ainda costuma chegar com a tela
     *  acesa). */
    private void adquirirMulticastLock() {
        try {
            Context ctx = plugin.getContext().getApplicationContext();
            WifiManager wifi = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                WifiManager.MulticastLock lock = wifi.createMulticastLock("nmea-socket-udp");
                lock.setReferenceCounted(true);
                lock.acquire();
                multicastLock = lock;
            }
        } catch (SecurityException e) {
            Log.w(TAG, "Sem permissao pro multicast lock: " + e.getMessage());
        }
    }

    /** Backoff exponencial: 1s, 2s, 4s... ate 30s — mesma filosofia do
     *  reconnect do transporte Signal K (`web/lib/nmea/signalk.ts`), so
     *  que aqui do lado nativo. */
    private int aguardarReconexao(int tentativa) {
        long esperaMs = Math.min(RECONEXAO_BASE_MS * (1L << Math.min(tentativa, 5)), RECONEXAO_MAXIMA_MS);
        try {
            Thread.sleep(esperaMs);
        } catch (InterruptedException interrompido) {
            Thread.currentThread().interrupt();
        }
        return tentativa + 1;
    }
}
