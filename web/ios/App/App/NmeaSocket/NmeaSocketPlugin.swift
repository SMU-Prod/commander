import Capacitor
import Foundation

/**
 * Onda 14 — ponte JS <-> `NmeaSocketWorker` (a logica de socket de
 * verdade vive la; ver esse arquivo).
 *
 * Plugin no estilo "moderno" do Capacitor (`CAPBridgedPlugin`, sem
 * arquivo `.m` com a macro `CAP_PLUGIN` — desnecessaria desde que a
 * classe seja `@objc` e implemente o protocolo). A Bridge descobre
 * plugins do proprio app target automaticamente varrendo o runtime
 * Objective-C por classes `CAPBridgedPlugin` — NAO precisa registrar em
 * nenhum lugar do codigo, MAS o arquivo precisa estar de fato no target
 * "App" do Xcode.
 *
 * PASSO MANUAL OBRIGATORIO (nao rodou aqui — sem Xcode nesta maquina):
 * como este arquivo e `NmeaSocketWorker.swift` foram criados fora do
 * Xcode, abra `ios/App/App.xcodeproj`, clique com o botao direito em
 * "App" > "Add Files to 'App'..." e adicione a pasta `NmeaSocket/`
 * (manter "Copy items if needed" DESMARCADO — os arquivos ja estao no
 * lugar certo; conferir "Add to target: App" marcado). Sem esse passo o
 * Xcode simplesmente nao compila estes arquivos. Ver docs/APP-NATIVO.md.
 */
@objc(NmeaSocketPlugin)
public class NmeaSocketPlugin: CAPPlugin, CAPBridgedPlugin, NmeaSocketWorkerDelegate {
    public let identifier = "NmeaSocketPlugin"
    public let jsName = "NmeaSocket"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "conectar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "desconectar", returnType: CAPPluginReturnPromise),
    ]

    private lazy var worker = NmeaSocketWorker(delegate: self)

    /// `conectar({ modo: "tcp" | "udp", host?, porta? })` — tipo espelhado
    /// em `web/lib/nmea/nmea-socket-plugin.ts`. Resolve assim que a
    /// tentativa de conexao comeca (nao espera abrir de fato — isso vem
    /// via evento "status").
    @objc func conectar(_ call: CAPPluginCall) {
        let modo = call.getString("modo") ?? "udp"
        let host = call.getString("host")
        let porta = call.getInt("porta") ?? NmeaSocketWorker.portaPadrao

        if modo == "tcp", host == nil || host?.isEmpty == true {
            call.reject("Modo 'tcp' exige 'host' (IP do gateway NMEA na rede do barco).")
            return
        }
        guard porta > 0, porta <= 65535 else {
            call.reject("Porta invalida: \(porta)")
            return
        }

        worker.conectar(modo: modo, host: host, porta: UInt16(porta))
        call.resolve()
    }

    @objc func desconectar(_ call: CAPPluginCall) {
        worker.desconectar()
        call.resolve()
    }

    // MARK: - NmeaSocketWorkerDelegate

    func aoReceberLinha(_ linha: String) {
        notifyListeners("linha", data: ["linha": linha])
    }

    func aoMudarStatus(_ status: String, mensagem: String?) {
        var dados: [String: Any] = ["status": status]
        if let mensagem = mensagem {
            dados["mensagem"] = mensagem
        }
        notifyListeners("status", data: dados)
    }
}
