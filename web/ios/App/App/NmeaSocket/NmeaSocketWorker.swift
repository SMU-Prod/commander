import Foundation
import Network

protocol NmeaSocketWorkerDelegate: AnyObject {
    func aoReceberLinha(_ linha: String)
    /// status: "conectando" | "conectado" | "desconectado" | "erro"
    func aoMudarStatus(_ status: String, mensagem: String?)
}

/**
 * Onda 14 — cliente TCP e listener UDP (broadcast) pra um gateway WiFi
 * NMEA 0183, via `Network.framework` (`NWConnection`/`NWListener` — API
 * recomendada pela Apple desde o iOS 12 pra sockets de baixo nivel;
 * substitui BSD sockets/`CFSocket` cru, integra sozinha com o path
 * monitor de rede do sistema). Todo callback roda numa `DispatchQueue`
 * serial dedicada (`fila`), nunca na main queue.
 *
 * Porta/modo padrao: mesma pesquisa do lado Android — ver
 * `NmeaSocketWorker.java` (`android/.../nmea/`) pra fonte (IANA
 * registrou 10110/tcp e 10110/udp pro servico "nmea-0183"; convencao dos
 * gateways WiFi NMEA recreativos e UDP broadcast nessa porta por padrao,
 * TCP como alternativa ponto-a-ponto).
 *
 * iOS 14+ exige a permissao "Local Network" pra qualquer socket contra
 * IPs da rede local (nao so Bonjour) — `NSLocalNetworkUsageDescription`
 * em `Info.plist` (ja adicionada, ver esse arquivo) e o que dispara o
 * prompt a primeira vez que `iniciarTcp`/`iniciarUdp` abre um socket.
 * Sem o usuario aceitar, as chamadas de rede falham silenciosamente
 * (nunca chegam em `.ready` nem em `.failed` de forma obvia em algumas
 * versoes do iOS) — sinal conhecido, documentado em
 * docs/APP-NATIVO.md, nao verificavel sem device (sem Xcode nesta
 * maquina).
 *
 * `geracao` invalida callbacks de uma tentativa de conexao anterior
 * depois de `desconectar()`/uma nova `conectar()`: os closures de
 * `NWConnection`/`NWListener` capturam a geracao no momento em que foram
 * criados e comparam antes de agir — evita que uma resposta tardia de um
 * socket ja descartado mexa no estado atual.
 */
final class NmeaSocketWorker {
    static let portaPadrao: Int = 10110

    private static let reconexaoBaseMs = 1000.0
    private static let reconexaoMaximaMs = 30_000.0

    private weak var delegate: NmeaSocketWorkerDelegate?
    private let fila = DispatchQueue(label: "br.com.soumardivers.commander.nmea-socket")

    private var rodando = false
    private var geracao = 0

    private var conexaoTcp: NWConnection?
    private var bufferTcp = Data()

    private var listenerUdp: NWListener?
    private var conexoesUdp: [ObjectIdentifier: NWConnection] = [:]

    init(delegate: NmeaSocketWorkerDelegate) {
        self.delegate = delegate
    }

    func conectar(modo: String, host: String?, porta: UInt16) {
        fila.async { [self] in
            pararInterno()
            rodando = true
            geracao += 1
            let g = geracao
            if modo == "tcp", let host = host {
                iniciarTcp(host: host, porta: porta, tentativa: 0, geracao: g)
            } else {
                iniciarUdp(porta: porta, tentativa: 0, geracao: g)
            }
        }
    }

    func desconectar() {
        fila.async { [self] in
            let estavaRodando = rodando
            pararInterno()
            if estavaRodando {
                delegate?.aoMudarStatus("desconectado", mensagem: nil)
            }
        }
    }

    /// So chamar de dentro de `fila`.
    private func pararInterno() {
        rodando = false
        geracao += 1 // invalida qualquer callback de conexao anterior
        conexaoTcp?.cancel()
        conexaoTcp = nil
        bufferTcp.removeAll()
        listenerUdp?.cancel()
        listenerUdp = nil
        for (_, conexao) in conexoesUdp {
            conexao.cancel()
        }
        conexoesUdp.removeAll()
    }

    // MARK: - TCP

    private func iniciarTcp(host: String, porta: UInt16, tentativa: Int, geracao: Int) {
        guard rodando, geracao == self.geracao, let port = NWEndpoint.Port(rawValue: porta) else { return }
        delegate?.aoMudarStatus("conectando", mensagem: nil)

        let conexao = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)
        conexaoTcp = conexao
        bufferTcp.removeAll()

        conexao.stateUpdateHandler = { [weak self] estado in
            guard let self = self else { return }
            self.fila.async {
                guard geracao == self.geracao else { return }
                switch estado {
                case .ready:
                    self.delegate?.aoMudarStatus("conectado", mensagem: nil)
                    self.receberTcp(conexao: conexao, geracao: geracao)
                case .failed(let erro):
                    self.delegate?.aoMudarStatus("erro", mensagem: erro.localizedDescription)
                    conexao.cancel()
                    self.agendarReconexaoTcp(host: host, porta: porta, tentativa: tentativa, geracao: geracao)
                default:
                    break
                }
            }
        }
        conexao.start(queue: fila)
    }

    private func receberTcp(conexao: NWConnection, geracao: Int) {
        conexao.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] dados, _, completo, erro in
            guard let self = self else { return }
            self.fila.async {
                guard geracao == self.geracao else { return }
                if let dados = dados, !dados.isEmpty {
                    self.bufferTcp.append(dados)
                    self.extrairLinhas(de: &self.bufferTcp)
                }
                if erro != nil {
                    // Nao decide reconexao aqui: cancelar a conexao dispara
                    // `stateUpdateHandler` com `.failed` (a API do
                    // Network.framework sempre transiciona o estado junto
                    // de um erro de leitura fatal) — e ele quem chama
                    // `agendarReconexaoTcp`, um unico lugar decidindo isso
                    // em vez de duplicar a logica aqui.
                    conexao.cancel()
                    return
                }
                if completo {
                    self.delegate?.aoMudarStatus("erro", mensagem: "Gateway fechou a conexao TCP.")
                    conexao.cancel()
                    return
                }
                self.receberTcp(conexao: conexao, geracao: geracao)
            }
        }
    }

    private func agendarReconexaoTcp(host: String, porta: UInt16, tentativa: Int, geracao: Int) {
        let esperaMs = min(Self.reconexaoBaseMs * pow(2, Double(min(tentativa, 5))), Self.reconexaoMaximaMs)
        fila.asyncAfter(deadline: .now() + esperaMs / 1000) { [weak self] in
            guard let self = self, geracao == self.geracao, self.rodando else { return }
            self.iniciarTcp(host: host, porta: porta, tentativa: tentativa + 1, geracao: geracao)
        }
    }

    // MARK: - UDP (listener de broadcast — sem host de destino: qualquer
    // datagrama que chegar nesta porta, unicast ou broadcast, e tratado
    // como linha NMEA)

    private func iniciarUdp(porta: UInt16, tentativa: Int, geracao: Int) {
        guard rodando, geracao == self.geracao, let port = NWEndpoint.Port(rawValue: porta) else { return }
        delegate?.aoMudarStatus("conectando", mensagem: nil)

        let params = NWParameters.udp
        params.allowLocalEndpointReuse = true

        guard let listener = try? NWListener(using: params, on: port) else {
            delegate?.aoMudarStatus("erro", mensagem: "Nao foi possivel abrir a porta UDP \(porta).")
            agendarReconexaoUdp(porta: porta, tentativa: tentativa, geracao: geracao)
            return
        }
        listenerUdp = listener

        listener.stateUpdateHandler = { [weak self] estado in
            guard let self = self else { return }
            self.fila.async {
                guard geracao == self.geracao else { return }
                switch estado {
                case .ready:
                    self.delegate?.aoMudarStatus("conectado", mensagem: nil)
                case .failed(let erro):
                    self.delegate?.aoMudarStatus("erro", mensagem: erro.localizedDescription)
                    listener.cancel()
                    self.agendarReconexaoUdp(porta: porta, tentativa: tentativa, geracao: geracao)
                default:
                    break
                }
            }
        }

        listener.newConnectionHandler = { [weak self] conexao in
            guard let self = self else { return }
            self.fila.async {
                guard geracao == self.geracao else {
                    conexao.cancel()
                    return
                }
                let chave = ObjectIdentifier(conexao)
                self.conexoesUdp[chave] = conexao
                conexao.stateUpdateHandler = { estado in
                    if case .cancelled = estado {
                        self.fila.async { self.conexoesUdp.removeValue(forKey: chave) }
                    }
                    if case .failed = estado {
                        conexao.cancel()
                    }
                }
                conexao.start(queue: self.fila)
                self.receberUdp(conexao: conexao, geracao: geracao)
            }
        }

        listener.start(queue: fila)
    }

    private func receberUdp(conexao: NWConnection, geracao: Int) {
        conexao.receiveMessage { [weak self] dados, _, _, erro in
            guard let self = self else { return }
            self.fila.async {
                guard geracao == self.geracao else { return }
                if let dados = dados, !dados.isEmpty, let texto = String(data: dados, encoding: .ascii) {
                    // Normalmente 1 sentenca por datagrama, mas alguns
                    // gateways enfileiram varias linhas no mesmo pacote.
                    for linha in texto.split(whereSeparator: { $0 == "\r" || $0 == "\n" }) where !linha.isEmpty {
                        self.delegate?.aoReceberLinha(String(linha))
                    }
                }
                if erro == nil {
                    self.receberUdp(conexao: conexao, geracao: geracao)
                }
            }
        }
    }

    private func agendarReconexaoUdp(porta: UInt16, tentativa: Int, geracao: Int) {
        let esperaMs = min(Self.reconexaoBaseMs * pow(2, Double(min(tentativa, 5))), Self.reconexaoMaximaMs)
        fila.asyncAfter(deadline: .now() + esperaMs / 1000) { [weak self] in
            guard let self = self, geracao == self.geracao, self.rodando else { return }
            self.iniciarUdp(porta: porta, tentativa: tentativa + 1, geracao: geracao)
        }
    }

    private func extrairLinhas(de buffer: inout Data) {
        let separadores: Set<UInt8> = [0x0D, 0x0A] // \r \n
        while let idx = buffer.firstIndex(where: { separadores.contains($0) }) {
            let linhaDados = buffer[buffer.startIndex..<idx]
            buffer.removeSubrange(buffer.startIndex...idx)
            if let linha = String(data: linhaDados, encoding: .ascii), !linha.isEmpty {
                delegate?.aoReceberLinha(linha)
            }
        }
    }
}
