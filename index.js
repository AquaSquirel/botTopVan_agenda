const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('node:fs');

const client = new Client({
    authStrategy: new LocalAuth()
});

// Caminho do arquivo
const AGENDAMENTOS_FILE = './agendamentos.json';

// Salvar agendamentos no arquivo
function salvarAgendamentos() {
    const agendamentosFiltrados = {};

    for (const userId in agendamentos) {
        const user = agendamentos[userId];
        if (user.agendamentos.length > 0) {
            agendamentosFiltrados[userId] = {
                agendamentos: user.agendamentos
            };
        }
    }

    fs.writeFileSync(AGENDAMENTOS_FILE, JSON.stringify(agendamentosFiltrados, null, 2));
}

// Carregar agendamentos do arquivo
function carregarAgendamentos() {
    if (fs.existsSync(AGENDAMENTOS_FILE)) {
        const data = fs.readFileSync(AGENDAMENTOS_FILE);
        const agendsSalvos = JSON.parse(data);

        const agendsCompletos = {};

        for (const userId in agendsSalvos) {
            agendsCompletos[userId] = {
                andamento: 0,
                registroTemp: {},
                agendamentos: agendsSalvos[userId].agendamentos || []
            };
        }

        return agendsCompletos;
    } else {
        return {};
    }
}

let agendamentos = carregarAgendamentos();

// Função para converter a data no formato dd/mm para yyyy-mm-dd
function converterDataParaOrdenavel(data) {
    const [dia, mes] = data.split('/'); // Espera o formato "dd/mm"
    const ano = new Date().getFullYear(); // Usa o ano atual
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// Ordenar os agendamentos por data
function ordenarAgendamentosPorData(agendamentos) {
    return agendamentos.sort((a, b) => {
        const dataA = converterDataParaOrdenavel(a.data);
        const dataB = converterDataParaOrdenavel(b.data);
        return dataA.localeCompare(dataB); // Ordena de forma crescente
    });
}

function formatarNome(name) {
    if (!name) return "";
    
    return name
      .toLowerCase()                // deixa tudo minúsculo primeiro
      .split(' ')                   // separa por espaço
      .map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      )                              // coloca primeira letra maiúscula em cada palavra
      .join(' ');                    // junta tudo de novo
  }

function mandarAgenda(client, message, user){
           // Ordena os agendamentos antes de enviar
           const agendamentosOrdenados = ordenarAgendamentosPorData(user.agendamentos);

           // Enviar os agendamentos ordenados
           let resposta = '**Agendamentos:**\n\n';
           agendamentosOrdenados.forEach((agendamento, index) => {
               resposta += `${index + 1}. *Destino:* ${agendamento.destino} \n-*Data:* ${agendamento.data} \n\n`;
           });

           client.sendMessage(message.from, resposta);

}

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message_create', message => {
    const originalMsg = message.body;
    const msg = originalMsg.toLowerCase();
    const userId = message.from;

    if (!agendamentos[userId]) {
        agendamentos[userId] = { andamento: 0, registroTemp: {}, agendamentos: [] };
    }

    const user = agendamentos[userId];

    if(msg == 'agenda'){
        mandarAgenda(client, message, user);
    }

    if (msg === 'agendar') {
        user.andamento = 1;
        user.registroTemp = {};
        client.sendMessage(message.from, 'Qual o destino?');
        return;
    }

    if(user.andamento == 0 && !isNaN(msg)){
        //envia os detalhes da agenda expecifica de acordo com o index]
        const index = parseInt(msg) - 1; // Ajusta para o índice correto
        if (index >= 0 && index < user.agendamentos.length) {
            const agendamento = user.agendamentos[index];
            client.sendMessage(message.from, `*Destino:* ${agendamento.destino}\n\n- *Data:* ${agendamento.data}\n\n- *Contratante:* ${agendamento.contratante}\n\n- *Valor:* ${agendamento.valor}\n\n- *Passageiros:* ${agendamento.passageiros}`);
        } else {
            client.sendMessage(message.from, 'Agendamento não encontrado.');
        }
        return;
    }

    if (user.andamento === 1) {
        user.registroTemp.destino = formatarNome(originalMsg);
        user.andamento = 2;
        client.sendMessage(message.from, 'Qual a data? (Formato: dia/mês)');
        return;
    }

    if (user.andamento === 2) {
        user.registroTemp.data = originalMsg; // Usar a resposta original
        user.andamento = 3;
        client.sendMessage(message.from, 'Qual o contratante?');
        return;
    }

    if (user.andamento === 3) {
        user.registroTemp.contratante = formatarNome(originalMsg); // Usar a resposta original
        user.andamento = 4;
        client.sendMessage(message.from, 'Qual o valor da viagem?');
        return;
    }

    if (user.andamento === 4) {
        user.registroTemp.valor = `R$: ${originalMsg}`; // Usar a resposta original
        user.andamento = 5;
        client.sendMessage(message.from, 'Quantos passageiros?');
        return;
    }

    // Quando o usuário envia a data
    if (user.andamento === 5) {
        user.registroTemp.passageiros = originalMsg; // Usar a resposta original
        user.agendamentos.push({ ...user.registroTemp }); // Adiciona o novo agendamento
        user.andamento = 0;
        user.registroTemp = {}; // Limpa o temporário


        client.sendMessage(message.from, 'Agendamento realizado com sucesso!');

        mandarAgenda(client, message, user);

        salvarAgendamentos();
        return;
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();