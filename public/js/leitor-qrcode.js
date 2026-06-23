const statusDiv = document.getElementById("status");
let bloqueado = false;

function mudarStatus(texto, classe = "") {
  statusDiv.className = "status " + classe;
  statusDiv.innerText = texto;
}

async function registrarQRCode(codigo) {
  if (bloqueado) return;

  bloqueado = true;
  mudarStatus("Processando...", "processando");

  try {
    const resposta = await fetch("/registrar-qrcode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ codigo })
    });

    const dados = await resposta.json();

    if (dados.sucesso) {
      mudarStatus("✅ " + dados.registro.nome + " - Entrada registrada", "sucesso");
    } else {
      const codigoLido = String(codigo || '').slice(0, 80);
      const detalhe = dados.status === 'nao_encontrado' && codigoLido
        ? " Código lido: " + codigoLido
        : "";

      mudarStatus(dados.mensagem + detalhe, "erro");
    }
  } catch (error) {
    mudarStatus("Erro ao conectar com o servidor", "erro");
  }

  setTimeout(() => {
    mudarStatus("Aguardando próxima leitura...");
    bloqueado = false;
  }, 3000);
}

function aoLerQRCode(decodedText) {
  registrarQRCode(decodedText);
}

const html5QrCode = new Html5Qrcode("reader");

Html5Qrcode.getCameras()
  .then((cameras) => {
    if (cameras && cameras.length) {
      const cameraTraseira = cameras.find((camera) =>
        camera.label.toLowerCase().includes("back") ||
        camera.label.toLowerCase().includes("traseira") ||
        camera.label.toLowerCase().includes("environment")
      );

      const cameraId = cameraTraseira ? cameraTraseira.id : cameras[0].id;

      html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250
          }
        },
        aoLerQRCode
      );
    } else {
      mudarStatus("Nenhuma câmera encontrada", "erro");
    }
  })
  .catch(() => {
    mudarStatus("Permissão da câmera negada ou erro ao abrir câmera", "erro");
  });